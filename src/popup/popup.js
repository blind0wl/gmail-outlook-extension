// A v5 inbox popup. Reads the normalized cache from chrome.storage.local
// key "mailCache" only (shape from src/store/cache.js):
// { key, provider, account, from, subject, snippet, date, unread, localRead }
// Keys include provider, encoded account, and message ID. No network calls.
// Per-account error rows (stale, offline, needs sign in) read the worker's
// "accountState" flags and recover via a "sign-in" runtime message.

import { THEME_KEY, DEFAULT_THEME, validTheme, loadTheme, saveTheme } from "./themes.js";
import { normalizeAccount, accountKey } from "../store/accounts.js";
import { threadUrl } from "./links.js";
import { accountStatusLabel } from "../notify/notify.js";
import { getSoundSettings, setMuted, setVolume, SOUND_SETTINGS_KEY, soundControlKeys } from "../notify/sound.js";

(function () {
  "use strict";

  var CACHE_KEY = "mailCache";

  var filter = "all";
  var mailScroll = 0;
  var themeWrites = 0;
  var themeSelection = 0;
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
      status.textContent = result?.ok ? "" : message.type === "refresh" ? "Could not refresh mail. Try Refresh again." : "Account action failed" + code + ". Check the account details and try Sign in.";
      return result;
    } catch {
      status.textContent = message.type === "refresh" ? "Could not refresh mail. Try Refresh again." : "Account action failed. Try again.";
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
      var identity = document.createElement("small");
      identity.className = "account-detail";
      var stateLabel = accountStatusLabel(acct, accountState[accountKey(acct)] || {});
      identity.textContent = (acct.provider === "outlook" ? "Outlook" : "Gmail") +
        (acct.enabled === false ? " · Paused" : stateLabel ? " · " + stateLabel.slice(acct.account.length + 3) : "");
      row.append(name, identity, actions);
      [["Sign in", "sign-in"], ["Sign out", "sign-out"], ["Remove", "remove-account"]].forEach(function (entry) {
        var button = document.createElement("button");
        button.type = "button";
        button.dataset.action = entry[1];
        // Keep pending controls focusable through cache updates; sendAction
        // blocks repeated activation while aria-disabled exposes busy state.
        button.setAttribute("aria-disabled", String(pendingAccountActions.has(row.dataset.accountKey + ":" + entry[1])));
        button.textContent = pendingAccountActions.has(row.dataset.accountKey + ":" + entry[1])
          ? entry[1] === "sign-in" ? "Signing in…" : "Working…" : entry[0];
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
    var keys = new Set(configuredAccounts.map(accountKey));
    var count = items.filter(function (item) { return keys.has(accountKey(item)) && isUnread(item); }).length;
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
    var focusedRecovery = active?.closest?.(".status-signin")?.dataset.accountKey;
    var hadListFocus = list.contains(active);
    var recoveryFocus = null;
    while (list.firstChild) list.removeChild(list.firstChild);
    var shown = visibleItems();
    var sections = configuredAccounts.filter(function (acct) { return filter === "all" || acct.provider === filter; });
    empty.hidden = sections.length !== 0;
    empty.textContent = configuredAccounts.length ? "No accounts match this filter." : "Connect an account in Settings to see your mail.";
    var index = 0;
    sections.forEach(function (acct) {
      var group = document.createElement("li");
      group.className = "account-section";
      group.dataset.accountKey = accountKey(acct);
      var heading = document.createElement("header");
      heading.className = "account-heading";
      var top = document.createElement("div");
      top.className = "account-heading-top";
      var badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = acct.provider === "outlook" ? "Outlook" : "Gmail";
      var mail = shown.filter(function (item) { return accountKey(item) === accountKey(acct); });
      var count = document.createElement("span");
      count.className = "account-count";
      count.textContent = mail.filter(isUnread).length + " unread";
      top.append(badge, count);
      var address = document.createElement("h2");
      address.textContent = acct.account;
      address.id = "account-heading-" + index++;
      group.setAttribute("aria-labelledby", address.id);
      heading.append(top, address);
      group.appendChild(heading);
      var state = { ...(accountState[accountKey(acct)] || {}) };
      if (typeof navigator !== "undefined" && navigator.onLine === false && !state.needsSignIn) state.offline = true;
      var status = acct.enabled === false ? "Paused" : accountStatusLabel(acct, state);
      if (status) {
        var note = document.createElement("div");
        note.className = "account-note";
        var label = document.createElement("span");
        label.textContent = status;
        note.appendChild(label);
        if (state.needsSignIn && acct.enabled !== false) {
          var recovery = document.createElement("button");
          recovery.type = "button";
          recovery.className = "status-signin";
          recovery.dataset.accountKey = accountKey(acct);
          recovery.textContent = "Manage sign-in";
          recovery.setAttribute("aria-label", "Manage sign-in for " + acct.account);
          recovery.addEventListener("click", function () {
            showView(true);
            var row = [...document.querySelectorAll("#account-controls li")].find(function (row) { return row.dataset.accountKey === accountKey(acct); });
            row?.querySelector('[data-action="sign-in"]')?.focus();
          });
          note.appendChild(recovery);
          if (focusedRecovery === accountKey(acct)) recoveryFocus = recovery;
        }
        group.appendChild(note);
      }
      var messageList = document.createElement("ul");
      messageList.className = "account-mail";
      group.appendChild(messageList);
      list.appendChild(group);
      if (!mail.length) {
        var noMail = document.createElement("p");
        noMail.className = "account-empty";
        noMail.textContent = "No messages to show.";
        group.appendChild(noMail);
      }
      mail.forEach(function (item) {
        var read = !isUnread(item);

        var card = document.createElement("li");
        card.className = "card" + (read ? " read" : "");
        card.setAttribute("data-key", item.key);
        var summary = document.createElement("button");
        summary.type = "button";
        summary.className = "card-summary";
        summary.setAttribute("aria-label", "Preview " + (item.subject || "(no subject)") + " for " + item.account + " (" + (item.provider === "outlook" ? "Outlook" : "Gmail") + ")");
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

        var sender = document.createElement("span");
        sender.className = "card-sender";
        sender.textContent = item.from || "Unknown sender";
        top.appendChild(sender);

        var time = document.createElement("span");
        time.className = "card-time";
        time.textContent = formatTime(item.date);
        top.appendChild(time);
        summary.appendChild(top);

        var main = document.createElement("span");
        main.className = "card-main";

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
        preview.id = "mail-preview-" + index++;
        preview.hidden = !expanded.has(item.key);
        var fullSubject = document.createElement("p");
        fullSubject.textContent = item.subject || "(no subject)";
        var fullSnippet = document.createElement("p");
        fullSnippet.textContent = item.snippet || "";
        preview.append(fullSubject, fullSnippet);
        card.appendChild(preview);
        function selectCard() {
          if (expanded.has(item.key)) expanded.delete(item.key);
          else expanded.add(item.key);
          preview.hidden = !expanded.has(item.key);
          summary.setAttribute("aria-expanded", String(!preview.hidden));
        }
        summary.addEventListener("click", selectCard);

        messageList.appendChild(card);
        if (focusedKey === item.key) (focusedOpen ? open : summary).focus();
      });
    });
    if (recoveryFocus) recoveryFocus.focus();
    else if (hadListFocus && !list.contains(document.activeElement)) document.getElementById("refresh-mail").focus();
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
      configuredAccounts = Array.isArray(list) ? list.map(normalizeAccount) : [];
      render();
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
    renderSound();
  }

  function renderStatus() {
    renderAccounts();
    renderList();
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

  function showView(settings) {
    var mail = document.getElementById("mail-view");
    var view = document.getElementById("settings-view");
    if (settings && !mail.hidden) mailScroll = mail.scrollTop;
    mail.hidden = settings;
    view.hidden = !settings;
    document.getElementById("mail-tools").hidden = settings;
    document.getElementById("settings-tools").hidden = !settings;
    document.getElementById("workspace-title").textContent = settings ? "Settings" : "Inbox";
    document.getElementById("unread-count").hidden = settings;
    if (!settings) mail.scrollTop = mailScroll;
    document.getElementById(settings ? "back-to-mail" : "open-settings").focus();
  }

  function applyTheme(theme) {
    var selected = validTheme(theme);
    document.documentElement.dataset.theme = selected;
    document.querySelectorAll('[name="popup-theme"]').forEach(function (radio) { radio.checked = radio.value === selected; });
  }

  function initThemes() {
    var message = document.getElementById("theme-message");
    var timer;
    var deadline = new Promise(function (_, reject) { timer = setTimeout(function () { reject(new Error("Theme read timed out")); }, 1500); });
    Promise.race([loadTheme(), deadline]).then(applyTheme).catch(function () {
      applyTheme(DEFAULT_THEME);
      message.textContent = "Could not load your theme. Midnight desk is available; try choosing a theme again.";
    }).finally(function () {
      clearTimeout(timer);
      document.body.removeAttribute("data-theme-loading");
    });
    document.querySelectorAll('[name="popup-theme"]').forEach(function (radio) {
      radio.addEventListener("change", async function () {
        if (!radio.checked) return;
        var selection = ++themeSelection;
        applyTheme(radio.value);
        themeWrites++;
        try {
          await saveTheme(radio.value);
          if (selection === themeSelection) message.textContent = "";
        } catch {
          if (selection === themeSelection) message.textContent = "Your theme could not be saved. Try choosing it again.";
        } finally {
          themeWrites--;
        }
      });
    });
  }

  function init() {
    initThemes();
    document.getElementById("open-settings").addEventListener("click", function () { showView(true); });
    document.getElementById("back-to-mail").addEventListener("click", function () { showView(false); });
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
          if (changes[THEME_KEY] && !themeWrites) applyTheme(changes[THEME_KEY].newValue);
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
            configuredAccounts = Array.isArray(anext) ? anext.map(normalizeAccount) : [];
            render();
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
