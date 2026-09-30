// A v5 inbox popup. Reads the normalized cache from chrome.storage.local
// key "mailCache" only (shape from src/store/cache.js):
// { key, provider, account, from, subject, snippet, date, unread, localRead }
// Keys include provider, encoded account, and message ID. No network calls.
// Per-account error rows (stale, offline, needs sign in) read the worker's
// "accountState" flags and recover via a "sign-in" runtime message.

import { threadUrl } from "./links.js";
import { accountStatusLabel } from "../notify/notify.js";
import { getSoundSettings, setMuted, setVolume, SOUND_SETTINGS_KEY, soundControlKeys } from "../notify/sound.js";

(function () {
  "use strict";

  var CACHE_KEY = "mailCache";

  var filter = "all";
  var items = [];
  // Configured accounts from the same storage key the worker polls
  // (`accounts`), so per-account chime toggles exist even with an empty
  // mail cache. Settings keys stay `provider:account`.
  var ACCOUNTS_KEY = "accounts";
  var configuredAccounts = [];
  // Per-account error flags persisted by the worker under ACCOUNT_STATE_KEY
  // ({ needsSignIn, offline, backedOff, retryAt, status } per
  // "provider:address"). Rendered as address-plus-code lines only — never
  // subject, snippet, or body. One failed account never hides the others.
  var ACCOUNT_STATE_KEY = "accountState";
  var accountState = {};
  // Sound settings mirror the worker's storage shape
  // ({ masterMuted, volume, mutedAccounts }) so both sides agree.
  var sound = { masterMuted: false, volume: 0.5, mutedAccounts: {} };

  function storageLocal() {
    return globalThis.chrome && chrome.storage ? chrome.storage.local : null;
  }

  function isUnread(item) {
    return item.unread === true && item.localRead !== true;
  }

  function openUrl(url) {
    if (globalThis.chrome && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: url });
    } else {
      globalThis.open(url, "_blank");
    }
  }

  function formatTime(date) {
    var d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    var now = new Date();
    var sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function avatarLetter(from) {
    var s = String(from || "").trim();
    return s ? s.charAt(0).toUpperCase() : "?";
  }

  var expanded = new Set();
  var pendingAccountActions = new Set();

  async function sendAction(message, button) {
    var actionKey = button?.dataset.action
      ? message.provider + ":" + message.account + ":" + message.type : null;
    if (actionKey && pendingAccountActions.has(actionKey)) return;
    if (actionKey) {
      pendingAccountActions.add(actionKey);
      renderAccounts();
      renderStatus();
    }
    if (button) {
      if (actionKey) button.setAttribute("aria-disabled", "true");
      else button.disabled = true;
    }
    var status = document.getElementById("lifecycle-message");
    try {
      var result = await chrome.runtime.sendMessage(message);
      var code = result?.code ? " (" + result.code + ")" : "";
      status.textContent = result?.ok ? "" : "Account action failed" + code + ". Check the account details and try Sign in.";
      return result;
    } catch {
      status.textContent = "Account action failed. Try again.";
    } finally {
      if (actionKey) {
        pendingAccountActions.delete(actionKey);
        renderAccounts();
        renderStatus();
      }
      if (button) button.disabled = false;
    }
  }

  function markRead(key) {
    for (var item of items) if (item.key === key) item.localRead = true;
    // The worker serializes the mutation with poll commits and updates badge.
    void sendAction({type: "mark-read", key: key});
    renderHeader();
  }

  function renderAccounts() {
    var list = document.getElementById("account-controls");
    var focused = document.activeElement?.closest?.("#account-controls button");
    var focusedAccount = focused?.closest("li")?.dataset.accountKey;
    var focusedAction = focused?.dataset.action;
    var nextFocus = null;
    list.replaceChildren();
    configuredAccounts.forEach(function (acct) {
      var row = document.createElement("li");
      row.dataset.accountKey = acct.provider + ":" + acct.account;
      var name = document.createElement("span");
      name.className = "account-name";
      name.textContent = acct.account;
      var actions = document.createElement("div");
      actions.className = "account-row-actions";
      row.append(name, actions);
      [["Sign in", "sign-in"], ["Sign out", "sign-out"], ["Remove", "remove-account"]].forEach(function (entry) {
        var button = document.createElement("button");
        button.type = "button";
        button.dataset.action = entry[1];
        // Keep pending controls focusable through cache updates; sendAction
        // blocks repeated activation while aria-disabled exposes busy state.
        button.setAttribute("aria-disabled", String(pendingAccountActions.has(row.dataset.accountKey + ":" + entry[1])));
        button.textContent = entry[0];
        button.setAttribute("aria-label", entry[0] + " " + acct.account);
        button.addEventListener("click", function () {
          void sendAction({type: entry[1], provider: acct.provider, account: acct.account}, button);
        });
        actions.appendChild(button);
        if (row.dataset.accountKey === focusedAccount && entry[1] === focusedAction)
          nextFocus = button;
      });
      list.appendChild(row);
    });
    if (nextFocus) {
      nextFocus.focus();
    } else if (focused) {
      document.getElementById("add-gmail").focus();
    }
  }

  function visibleItems() {
    var sorted = items.slice().sort(function (a, b) { return b.date - a.date; });
    if (filter === "all") return sorted;
    return sorted.filter(function (item) { return item.provider === filter; });
  }

  function renderHeader() {
    var count = items.filter(isUnread).length;
    var el = document.getElementById("unread-count");
    el.textContent = count > 0 ? "(" + count + ")" : "";
  }

  function renderPills() {
    var buttons = document.querySelectorAll(".pills button");
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute("data-filter") === filter;
      buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function renderList() {
    var list = document.getElementById("inbox-list");
    var empty = document.getElementById("inbox-empty");
    var active = document.activeElement;
    var focusedKey = active?.closest?.(".card")?.getAttribute("data-key");
    var focusedOpen = active?.classList?.contains("card-open");
    while (list.firstChild) list.removeChild(list.firstChild);
    var shown = visibleItems();
    empty.hidden = shown.length !== 0;

    shown.forEach(function (item, index) {
      var read = !isUnread(item);

      var card = document.createElement("li");
      card.className = "card" + (read ? " read" : "");
      card.setAttribute("data-key", item.key);
      var summary = document.createElement("button");
      summary.type = "button";
      summary.className = "card-summary";
      summary.setAttribute("aria-label", "Read: " + (item.subject || "(no subject)") + " for " + item.account + " (" + (item.provider === "outlook" ? "Outlook" : "Gmail") + ")");
      summary.setAttribute("aria-expanded", String(expanded.has(item.key)));
      summary.setAttribute("aria-controls", "mail-preview-" + index);

      if (!read) {
        var dot = document.createElement("span");
        dot.className = "unread-dot";
        dot.setAttribute("role", "img");
        dot.setAttribute("aria-label", "Unread");
        card.appendChild(dot);
      }

      var top = document.createElement("span");
      top.className = "card-top";

      var account = document.createElement("span");
      account.className = "card-account";
      var badge = document.createElement("span");
      badge.className = "badge " + (item.provider === "outlook" ? "badge-outlook" : "badge-gmail");
      badge.textContent = item.provider === "outlook" ? "Outlook" : "Gmail";
      account.appendChild(badge);
      account.appendChild(document.createTextNode(item.account || ""));
      top.appendChild(account);

      var time = document.createElement("span");
      time.className = "card-time";
      time.textContent = formatTime(item.date);
      top.appendChild(time);
      summary.appendChild(top);

      var main = document.createElement("span");
      main.className = "card-main";

      var avatar = document.createElement("span");
      avatar.className = "avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = avatarLetter(item.from);
      main.appendChild(avatar);

      var text = document.createElement("span");
      text.className = "card-text";

      var subject = document.createElement("span");
      subject.className = "card-subject";
      subject.textContent = item.subject || "(no subject)";
      text.appendChild(subject);

      var snippet = document.createElement("span");
      snippet.className = "card-snippet";
      snippet.textContent = item.snippet || "";
      text.appendChild(snippet);

      var open = document.createElement("button");
      open.type = "button";
      open.className = "card-open";
      open.textContent = "Open";
      open.setAttribute("aria-label", "Open " + (item.subject || "(no subject)") + " in " + (item.provider === "outlook" ? "Outlook" : "Gmail") + " for " + item.account);
      open.addEventListener("click", function (event) {
        event.stopPropagation();
        markRead(item.key);
        openUrl(threadUrl(item));
      });
      main.appendChild(text);
      summary.appendChild(main);
      card.append(summary, open);

      var preview = document.createElement("div");
      preview.className = "card-preview";
      preview.id = "mail-preview-" + index;
      preview.hidden = !expanded.has(item.key);
      var fullSubject = document.createElement("p");
      fullSubject.textContent = item.subject || "(no subject)";
      var fullSnippet = document.createElement("p");
      fullSnippet.textContent = item.snippet || "";
      preview.append(fullSubject, fullSnippet);
      card.appendChild(preview);
      function selectCard() {
        expanded.add(item.key);
        preview.hidden = false;
        summary.setAttribute("aria-expanded", "true");
        card.classList.add("read");
        card.querySelector(".unread-dot")?.remove();
        markRead(item.key);
      }
      summary.addEventListener("click", selectCard);

      list.appendChild(card);
      if (focusedKey === item.key) (focusedOpen ? open : summary).focus();
    });
  }

  // Sound settings surface. Master mute plus per-account chime toggles
  // plus volume, all persisted under the same storage key the worker
  // reads, so both sides agree. Storage only, no network.
  // Controls union configured accounts with cached-mail accounts, so a
  // configured account with no cached messages keeps its toggle.
  function soundAccountKeys() {
    return soundControlKeys(configuredAccounts, items);
  }

  function renderSound() {
    var master = document.getElementById("sound-muted");
    var slider = document.getElementById("sound-volume");
    var value = document.getElementById("sound-volume-value");
    var list = document.getElementById("sound-accounts");
    if (!master || !slider || !list) return;
    master.checked = sound.masterMuted === true;
    slider.value = String(Math.round((sound.volume ?? 0.5) * 100));
    if (value) value.textContent = slider.value + "%";
    slider.setAttribute("aria-valuetext", slider.value + "%");
    var focusedKey = document.activeElement?.closest?.("#sound-accounts input")?.dataset.soundKey;
    while (list.firstChild) list.removeChild(list.firstChild);
    soundAccountKeys().forEach(function (entry) {
      var li = document.createElement("li");
      var label = document.createElement("label");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.dataset.soundKey = entry.key;
      box.checked = !(sound.mutedAccounts && sound.mutedAccounts[entry.key] === true);
      box.setAttribute("aria-label", "Chime for " + entry.label);
      box.addEventListener("change", function () {
        var patch = {};
        patch[entry.key] = !box.checked;
        Promise.resolve(setMuted(undefined, patch)).then(function (next) {
          sound = next;
          renderSound();
        });
      });
      label.appendChild(box);
      var description = document.createElement("span");
      description.textContent = "Chime for " + entry.label;
      label.appendChild(description);
      li.appendChild(label);
      list.appendChild(li);
      if (entry.key === focusedKey) box.focus();
    });
    if (focusedKey && !list.contains(document.activeElement)) master.focus();
  }

  function loadSoundAccounts() {
    var store = storageLocal();
    if (!store) {
      configuredAccounts = [];
      renderSound();
      return;
    }
    Promise.resolve(store.get(ACCOUNTS_KEY)).then(function (data) {
      var list = data ? data[ACCOUNTS_KEY] : null;
      configuredAccounts = Array.isArray(list) ? list : [];
      renderAccounts();
      renderSound();
    });
  }

  function loadSound() {
    Promise.resolve(getSoundSettings()).then(function (next) {
      sound = next;
      renderSound();
    });
  }

  function render() {
    renderAccounts();
    renderHeader();
    renderPills();
    renderList();
    renderStatus();
    renderSound();
  }

  // Union of configured accounts and cached-mail accounts, so an account
  // with an error but no cached messages still gets its status row.
  function statusAccounts() {
    var seen = {};
    var out = [];
    function push(provider, account) {
      var key = provider + ":" + String(account || "").toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push({ provider: provider, account: account || "", key: key });
    }
    var i;
    for (i = 0; i < configuredAccounts.length; i++) {
      push(configuredAccounts[i].provider, configuredAccounts[i].account || configuredAccounts[i].address);
    }
    for (i = 0; i < items.length; i++) {
      push(items[i].provider, items[i].account);
    }
    return out;
  }

  function renderStatus() {
    var section = document.getElementById("account-status");
    var list = document.getElementById("account-status-list");
    if (!section || !list) return;
    var focused = document.activeElement?.closest?.(".status-signin");
    var focusedAccount = focused?.dataset.accountKey;
    var nextFocus = null;
    while (list.firstChild) list.removeChild(list.firstChild);
    var offlineNow = typeof navigator !== "undefined" && navigator.onLine === false;
    var rows = 0;
    statusAccounts().forEach(function (entry) {
      var stored = accountState[entry.key] || {};
      var state = {};
      for (var k in stored) state[k] = stored[k];
      if (offlineNow && !stored.needsSignIn) state.offline = true;
      var label = accountStatusLabel(entry, state);
      if (!label) return;
      rows += 1;
      var li = document.createElement("li");
      li.className = "status-row";
      li.appendChild(document.createTextNode(label));
      if (state.needsSignIn) {
        (function (provider, account) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "status-signin";
          btn.dataset.accountKey = provider + ":" + account;
          btn.dataset.action = "sign-in";
          var pending = pendingAccountActions.has(btn.dataset.accountKey + ":sign-in");
          btn.setAttribute("aria-disabled", String(pending));
          btn.textContent = pending ? "Signing in\u2026" : "Sign in";
          btn.setAttribute("aria-label", "Sign in " + account);
          btn.addEventListener("click", function () {
            void signInAccount(provider, account, btn);
          });
          li.appendChild(btn);
          if (btn.dataset.accountKey === focusedAccount) nextFocus = btn;
        })(entry.provider, entry.account);
      }
      list.appendChild(li);
    });
    section.hidden = rows === 0;
    if (nextFocus) nextFocus.focus();
    else if (focused) document.getElementById("add-gmail").focus();
  }

  // Interactive recovery for one account. The worker runs the visible auth
  // flow and repolls that account; storage-only here, no network calls.
  async function signInAccount(provider, account, button) {
    if (pendingAccountActions.has(provider + ":" + account + ":sign-in")) return;
    await sendAction({ type: "sign-in", provider: provider, account: account }, button);
    loadStatus();
  }

  function loadStatus() {
    var store = storageLocal();
    if (!store) {
      accountState = {};
      renderStatus();
      return;
    }
    Promise.resolve(store.get(ACCOUNT_STATE_KEY)).then(function (data) {
      var next = data ? data[ACCOUNT_STATE_KEY] : null;
      accountState = next && typeof next === "object" ? next : {};
      renderStatus();
    });
  }

  function load() {
    var store = storageLocal();
    if (!store) {
      items = [];
      render();
      return;
    }
    // Thread links carry the account address themselves, so only the mail
    // cache is needed. Storage reads only, no network.
    Promise.resolve(store.get(CACHE_KEY)).then(function (data) {
      var cached = data ? data[CACHE_KEY] : null;
      items = Array.isArray(cached) ? cached : [];
      render();
    });
  }

  function init() {
    var focusedToggle = document.getElementById("skip-focused");
    // Suppression is opt-in: unset means alerts always fire, even with
    // a provider tab focused.
    storageLocal()?.get("skipFocusedProvider").then(function (value) {
      focusedToggle.checked = value?.skipFocusedProvider === true;
    });
    focusedToggle.addEventListener("change", function () {
      void storageLocal()?.set({skipFocusedProvider: focusedToggle.checked});
    });
    var addForm = document.getElementById("add-account-form");
    var addTitle = document.getElementById("add-account-title");
    var addEmail = document.getElementById("add-account-email");
    var addNote = document.getElementById("add-account-note");
    var addHelpGmail = document.getElementById("add-account-help-gmail");
    var addHelpOutlook = document.getElementById("add-account-help-outlook");
    var addError = document.getElementById("add-account-error");
    var addProvider = null;
    var addOpener = null;
    function showAddForm(provider) {
      addProvider = provider;
      addOpener = document.getElementById("add-" + provider);
      var isGmail = provider === "gmail";
      addTitle.textContent = isGmail ? "Add Gmail account" : "Add Outlook account";
      // Neither provider asks users for IDs anymore: Gmail reads the
      // browser session, Outlook consent is handled by the extension.
      addNote.hidden = false;
      addNote.textContent = isGmail
        ? "No setup needed. Log into Gmail in any tab and press Add account."
        : "No setup needed. Press Add account and accept the Microsoft consent screen.";
      addHelpGmail.hidden = !isGmail;
      addHelpOutlook.hidden = isGmail;
      addError.hidden = true;
      addError.textContent = "";
      addForm.hidden = false;
      addEmail.focus();
    }
    function hideAddForm() {
      addProvider = null;
      addForm.hidden = true;
      addOpener?.focus();
    }
    ["gmail", "outlook"].forEach(function (provider) {
      document.getElementById("add-" + provider).addEventListener("click", function () {
        showAddForm(provider);
      });
    });
    document.getElementById("add-account-cancel").addEventListener("click", function () {
      hideAddForm();
    });
    addForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var account = addEmail.value.trim();
      if (!account) {
        addError.textContent = "Enter your email address.";
        addError.hidden = false;
        return;
      }
      var submit = document.getElementById("add-account-submit");
      var result = await sendAction({type: "add-account", provider: addProvider, account}, submit);
      if (result && result.ok) {
        addEmail.value = "";
        hideAddForm();
      } else {
        var addCode = result?.code ? " (" + result.code + ")" : "";
        addError.textContent = "Could not add the account" + addCode + ". Check the address and try again.";
        addError.hidden = false;
      }
    });
    document.getElementById("refresh-mail").addEventListener("click", function (event) {
      void sendAction({type: "refresh"}, event.currentTarget);
    });
    var buttons = document.querySelectorAll(".pills button");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (event) {
        filter = event.currentTarget.getAttribute("data-filter") || "all";
        render();
      });
    }
    var master = document.getElementById("sound-muted");
    if (master) {
      master.addEventListener("change", function () {
        Promise.resolve(setMuted(master.checked)).then(function (next) {
          sound = next;
          renderSound();
        });
      });
    }
    var slider = document.getElementById("sound-volume");
    if (slider) {
      slider.addEventListener("input", function () {
        document.getElementById("sound-volume-value").textContent = slider.value + "%";
        slider.setAttribute("aria-valuetext", slider.value + "%");
      });
      slider.addEventListener("change", function () {
        Promise.resolve(setVolume(Number(slider.value) / 100)).then(function (next) {
          sound = next;
          renderSound();
        });
      });
    }
    if (globalThis.chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === "local" && changes) {
          if (changes[CACHE_KEY]) {
            var next = changes[CACHE_KEY].newValue;
            items = Array.isArray(next) ? next : [];
            render();
          }
          if (changes[SOUND_SETTINGS_KEY]) {
            var snext = changes[SOUND_SETTINGS_KEY].newValue;
            if (snext) {
              sound = snext;
              renderSound();
            }
          }
          if (changes[ACCOUNTS_KEY]) {
            var anext = changes[ACCOUNTS_KEY].newValue;
            configuredAccounts = Array.isArray(anext) ? anext : [];
            renderAccounts();
            renderSound();
            renderStatus();
          }
          if (changes[ACCOUNT_STATE_KEY]) {
            var stnext = changes[ACCOUNT_STATE_KEY].newValue;
            accountState = stnext && typeof stnext === "object" ? stnext : {};
            renderStatus();
          }
        }
      });
    }
    loadSound();
    loadSoundAccounts();
    loadStatus();
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
