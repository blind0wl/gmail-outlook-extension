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

  var pendingAccountActions = new Set();

  function setStatus(text, state) {
    var status = document.getElementById("lifecycle-message");
    status.textContent = text;
    if (state) status.dataset.state = state;
    else status.removeAttribute("data-state");
  }

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
    var isAdd = message.type === "add-account";
    if (message.type === "refresh") setStatus("Checking mail\u2026", "progress");
    try {
      var result = await chrome.runtime.sendMessage(message);
      if (isAdd) return result;
      if (message.type === "refresh") {
        if (result?.ok) {
          // Per-account outcomes from the worker: only accounts the poll
          // actually reached count as checked. Anything else keeps its
          // error note and never earns a fresh stamp.
          var lists = result.checked || {};
          var attention = new Set([].concat(lists.backedOff || [], lists.needsSignIn || [], lists.offline || [], lists.failed || []));
          var bad = configuredAccounts.filter(function (a) { return a.enabled !== false && attention.has(accountKey(a)); });
          var when = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          if (bad.length) setStatus("Checked mail " + when + " \u2014 " + bad.length + " account(s) need attention.", "error");
          else setStatus("Checked mail " + when + ".", "ok");
        } else {
          setStatus("Could not refresh mail. Try Refresh again.", "error");
        }
      } else {
        if (result?.ok) setStatus("", "");
        else setStatus("Account action failed. Check the account details and try Sign in.", "error");
      }
      return result;
    } catch {
      if (isAdd) return undefined;
      setStatus(message.type === "refresh" ? "Could not refresh mail. Try Refresh again." : "Account action failed. Try again.", "error");
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
      // Lifecycle consequences live on the row they act on, not in a
      // single note below the whole list.
      var hint = document.createElement("small");
      hint.className = "account-hint";
      hint.textContent = (accountState[row.dataset.accountKey] || {}).needsSignIn && acct.enabled !== false
        ? "Sign in reconnects this account."
        : "Remove deletes the local entry only \u2014 provider mail is unchanged.";
      row.append(name, identity, actions, hint);
      [["Sign in", "sign-in"], ["Sign out", "sign-out"], ["Remove", "remove-account"]].forEach(function (entry) {
        var button = document.createElement("button");
        button.type = "button";
        button.dataset.action = entry[1];
        // Keep pending controls focusable through cache updates; sendAction
        // blocks repeated activation while aria-disabled exposes busy state.
        button.setAttribute("aria-disabled", String(pendingAccountActions.has(row.dataset.accountKey + ":" + entry[1])));
        button.textContent = pendingAccountActions.has(row.dataset.accountKey + ":" + entry[1])
          ? entry[1] === "sign-in" ? "Signing in…" : "Working…" : entry[0];
        button.title = entry[1] === "sign-in" ? "Connects " + acct.account
          : entry[1] === "sign-out" ? "Pauses polling for " + acct.account
          : "Deletes the local entry only; provider mail is unchanged";
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
    var sorted = displayedItems().sort(function (a, b) { return b.date - a.date; });
    if (filter === "all") return sorted;
    return sorted.filter(function (item) { return item.provider === filter; });
  }

  // Counts report provider unread mail; locally opened mail is named
  // separately so the numbers reconcile with the actual mailbox instead
  // of silently dropping when opened here.
  function providerUnread(list) {
    return list.filter(function (item) { return item.unread === true; }).length;
  }
  function openedHereCount(list) {
    return list.filter(function (item) { return item.unread === true && item.localRead === true; }).length;
  }
  function countText(list) {
    var unread = providerUnread(list);
    var opened = openedHereCount(list);
    if (unread === 0 && opened === 0) return "0 unread";
    return unread + " unread" + (opened > 0 ? " \u00B7 " + opened + " opened here" : "");
  }

  function renderHeader() {
    var keys = new Set(configuredAccounts.map(accountKey));
    var scoped = displayedItems().filter(function (item) { return keys.has(accountKey(item)); });
    var el = document.getElementById("unread-count");
    el.textContent = providerUnread(scoped) > 0
      ? "(" + providerUnread(scoped) + ")" + (openedHereCount(scoped) > 0 ? " \u00B7 " + openedHereCount(scoped) + " opened" : "")
      : "";
  }

  function renderPills() {
    var buttons = document.querySelectorAll(".pills button");
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute("data-filter") === filter;
      buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  var pendingMailActions = new Set();
  var mailActions = {};
  // Project pending actions over authoritative cache; never write optimistic mail state.
  var mailFeedback = new Map();
  function settleMailFeedback() {
    mailFeedback.forEach(function (feedback, key) {
      if (feedback.confirmed && !items.some(function (item) { return item.key === key && item.unread !== false; }))
        mailFeedback.delete(key);
    });
  }
  function displayedItems() {
    var projected = items.filter(function (item) {
      var feedback = mailFeedback.get(item.key);
      return feedback ? feedback.action === "read" && !feedback.confirmed : item.unread !== false;
    }).map(function (item) {
      return mailFeedback.has(item.key) ? { ...item, unread: false, localRead: false } : item;
    });
    // A storage event may arrive before the worker response. Keep pending read feedback visible.
    mailFeedback.forEach(function (feedback, key) {
      if (feedback.action === "read" && !feedback.confirmed && !projected.some(function (item) { return item.key === key; }))
        projected.push({ ...feedback.item, unread: false, localRead: false });
    });
    return projected;
  }
  var mailErrors = {};
  function actionIcon(kind) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", kind === "read" ? "M3 8l9 6 9-6M3 8l9-5 9 5v12H3V8M8 17l2 2 4-4" : "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7");
    svg.appendChild(path);
    return svg;
  }
  async function actOnMail(key, action) {
    if (pendingMailActions.has(key)) return;
    var actionItem = items.find(function (item) { return item.key === key; }) || mailActions[key]?.item;
    var unconfirmedMessage = "The result could not be confirmed. Check this action in your mailbox, then choose “I’ve checked” to unlock it. Other mail is still available.";
    pendingMailActions.add(key);
    delete mailErrors[key];
    if (action === "read" || action === "trash") mailFeedback.set(key, { action: action, item: actionItem, confirmed: false });
    setStatus(action === "read" ? "Marking as read…" : action === "trash" ? "Moving to Trash…" : "Updating mailbox…", "progress");
    renderHeader();
    renderList();
    renderUndo();
    try {
      var result = await chrome.runtime.sendMessage({ type: "mail-action", key: key, action: action });
      if (!result?.ok) {
        mailFeedback.delete(key);
        var code = result?.code;
        mailErrors[key] = code === "check-mailbox" ? unconfirmedMessage
          : code === "gmail-changed" ? "Gmail’s session interface changed. Open Gmail to manage this conversation."
          : code === "undo-expired" ? "Undo expired. Restore this mail in your mailbox."
          : "Could not complete the action. Check the account’s sign-in in Settings, then try again.";
        setStatus(mailErrors[key], "error");
      } else {
        if (mailFeedback.has(key)) mailFeedback.get(key).confirmed = true;
        if (action === "undo") mailFeedback.delete(key);
        settleMailFeedback();
        var readMessage = actionItem?.provider === "gmail"
          ? "Marked as read in Gmail. If an open Gmail page still shows unread, refresh that page."
          : "Marked as read in your mailbox.";
        setStatus(action === "acknowledge" ? "This action is unlocked. Refresh to check your inbox." : action === "read" ? readMessage : action === "trash" ? "Moved to Trash. Undo is available in Mailbox recovery." : "Restored to your inbox.", "ok");
      }
    } catch {
      mailFeedback.delete(key);
      mailErrors[key] = unconfirmedMessage;
      setStatus(mailErrors[key], "error");
    } finally {
      pendingMailActions.delete(key);
      renderHeader();
      renderList();
      renderUndo();
    }
  }
  var pendingRecoveryAccounts = new Set();
  async function acknowledgeAccount(acctKey, entries, address) {
    if (pendingRecoveryAccounts.has(acctKey)) return;
    pendingRecoveryAccounts.add(acctKey);
    setStatus("Unlocking checked actions…", "progress");
    renderUndo();
    var unlocked = 0;
    try {
      for (var entry of entries) {
        try {
          var result = await chrome.runtime.sendMessage({ type: "mail-action", key: entry[0], action: "acknowledge", expectedExpiresAt: entry[1].expiresAt ?? null });
          if (result?.ok) {
            unlocked++;
            // A storage update may already have removed this lock or installed
            // a newer one. Only remove the exact record the user checked.
            if (mailActions[entry[0]] === entry[1]) delete mailActions[entry[0]];
            delete mailErrors[entry[0]];
          }
        } catch { /* Keep failed locks available for explicit recovery. */ }
      }
      var remaining = entries.length - unlocked;
      var message = unlocked + " checked " + (unlocked === 1 ? "action" : "actions") + " unlocked for " + address + ". ";
      setStatus(message + (remaining ? "Could not unlock " + remaining + "; try “I’ve checked” again." : "Refresh to check your inbox."), remaining ? "error" : "ok");
    } finally {
      pendingRecoveryAccounts.delete(acctKey);
      renderList();
      renderUndo();
    }
  }
  function renderUndo() {
    var list = document.getElementById("mail-undo");
    var focused = document.activeElement?.dataset.undoKey;
    var focusedAccount = document.activeElement?.dataset.recoveryAccount;
    list.replaceChildren();
    var groups = new Map();
    Object.entries(mailActions).forEach(function (entry) {
      var key = entry[0], record = entry[1];
      if (pendingMailActions.has(key) || !["pending", "uncertain"].includes(record.state) || !configuredAccounts.some(a => accountKey(a) === accountKey(record.item))) return;
      var acctKey = accountKey(record.item);
      if (!groups.has(acctKey)) groups.set(acctKey, []);
      groups.get(acctKey).push(entry);
    });
    groups.forEach(function (entries, acctKey) {
      var address = entries[0][1].item.account;
      var count = entries.length;
      var row = document.createElement("li");
      var text = document.createElement("span");
      text.textContent = count + " unconfirmed " + (count === 1 ? "action" : "actions") + " · " + address + ". Check " + (count === 1 ? "this action" : "all these actions") + " in your mailbox before unlocking. Other mail is still available.";
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = pendingRecoveryAccounts.has(acctKey) ? "Unlocking…" : "I’ve checked";
      button.dataset.recoveryAccount = acctKey;
      button.setAttribute("aria-label", "I checked all " + count + " actions in my mailbox for " + address + "; unlock those actions");
      button.setAttribute("aria-disabled", String(pendingRecoveryAccounts.has(acctKey)));
      button.addEventListener("click", function () { void acknowledgeAccount(acctKey, entries, address); });
      row.append(text, button);
      list.appendChild(row);
      if (focusedAccount === acctKey) button.focus();
    });
    Object.entries(mailActions).forEach(function (entry) {
      var key = entry[0], record = entry[1];
      if (pendingMailActions.has(key) || record.state !== "undo" || record.expiresAt < Date.now() || !configuredAccounts.some(a => accountKey(a) === accountKey(record.item))) return;
      var row = document.createElement("li");
      var text = document.createElement("span");
      text.textContent = "Moved to Trash · " + record.item.account;
      var undo = document.createElement("button");
      undo.type = "button";
      undo.textContent = "Undo";
      undo.dataset.undoKey = key;
      undo.setAttribute("aria-label", "Restore " + (record.item.subject || "mail") + " to Inbox for " + record.item.account);
      undo.setAttribute("aria-disabled", String(pendingMailActions.has(key)));
      undo.addEventListener("click", function () { void actOnMail(key, "undo"); });
      row.append(text, undo);
      list.appendChild(row);
      if (focused === key) undo.focus();
    });
    list.hidden = !list.childElementCount;
  }

  function renderList() {
    var list = document.getElementById("inbox-list");
    var empty = document.getElementById("inbox-empty");
    var active = document.activeElement;
    var focusedKey = active?.closest?.(".card")?.getAttribute("data-key");
    var focusedAction = active?.dataset.mailAction;
    var focusedRecovery = active?.closest?.(".status-signin")?.dataset.accountKey;
    var hadListFocus = list.contains(active);
    var recoveryFocus = null;
    var index = 0;
    while (list.firstChild) list.removeChild(list.firstChild);
    var shown = visibleItems();
    var sections = configuredAccounts.filter(function (acct) { return filter === "all" || acct.provider === filter; });
    empty.hidden = sections.length !== 0;
    empty.textContent = configuredAccounts.length ? "No accounts match this filter." : "No accounts yet. Open Settings to connect Gmail or Outlook.";
    var setupCta = document.getElementById("empty-setup");
    if (setupCta) setupCta.hidden = configuredAccounts.length !== 0;
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
      // Freshness comes from the worker-persisted per-account stamp, so a
      // failed or paused account can never display a fresh check time.
      var acctState = { ...(accountState[accountKey(acct)] || {}) };
      if (typeof navigator !== "undefined" && navigator.onLine === false && !acctState.needsSignIn) acctState.offline = true;
      var count = document.createElement("span");
      count.className = "account-count";
      count.textContent = countText(mail);
      top.append(badge);
      if (acct.enabled !== false && acctState.checkedAt && !acctState.needsSignIn && !acctState.offline && !acctState.backedOff && !acctState.stale && acctState.status === undefined) {
        var checked = document.createElement("span");
        checked.className = "account-checked";
        checked.textContent = "Checked " + new Date(acctState.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        top.append(checked);
      }
      top.append(count);
      var address = document.createElement("h2");
      address.textContent = acct.account;
      address.id = "account-heading-" + index++;
      group.setAttribute("aria-labelledby", address.id);
      heading.append(top, address);
      group.appendChild(heading);
      var state = acctState;
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
        // A checked empty mailbox reads differently from missing data.
        noMail.textContent = (!status && state.checkedAt)
          ? "No messages to show \u2014 checked " + new Date(state.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + "."
          : "No messages to show.";
        group.appendChild(noMail);
      }
      mail.forEach(function (item) {
        var read = !isUnread(item);

        var card = document.createElement("li");
        card.className = "card" + (read ? " read" : "");
        card.setAttribute("data-key", item.key);
        if (!read) {
          var dot = document.createElement("span");
          dot.className = "unread-dot";
          dot.setAttribute("role", "img");
          dot.setAttribute("aria-label", "Unread");
          card.appendChild(dot);
        }

        // Mail content stays static until in-extension reading is implemented.
        var head = document.createElement("div");
        head.className = "card-head";

        var top = document.createElement("div");
        top.className = "card-top";

        var sender = document.createElement("span");
        sender.className = "card-sender";
        sender.textContent = item.from || "Unknown sender";
        top.appendChild(sender);

        var time = document.createElement("span");
        time.className = "card-time";
        time.textContent = formatTime(item.date);
        top.appendChild(time);
        if (item.unread === true && item.localRead === true) {
          var openedTag = document.createElement("span");
          openedTag.className = "opened-tag";
          openedTag.textContent = "Opened here";
          top.appendChild(openedTag);
        }
        head.appendChild(top);

        var subject = document.createElement("div");
        subject.className = "card-subject";
        subject.textContent = item.subject || "(no subject)";
        head.appendChild(subject);
        card.appendChild(head);

        var snippet = document.createElement("div");
        snippet.className = "card-snippet";
        snippet.textContent = item.snippet || "";
        card.appendChild(snippet);

        var open = document.createElement("button");
        open.type = "button";
        open.className = "card-open";
        open.textContent = "Open";
        open.title = "Opens the provider message and marks opened here (provider unread unchanged)";
        open.setAttribute("aria-label", "Open " + (item.subject || "(no subject)") + " in " + (item.provider === "outlook" ? "Outlook" : "Gmail") + " for " + item.account + " (marks opened here, provider unchanged)");
        open.addEventListener("click", function (event) {
          event.stopPropagation();
          markRead(item.key);
          openUrl(threadUrl(item));
        });
        var actionsRow = document.createElement("div");
        actionsRow.className = "card-actions";
        actionsRow.appendChild(open);
        var quick = document.createElement("div");
        quick.className = "card-quick-actions";
        ["read", "trash"].forEach(function (action) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "card-icon" + (action === "trash" ? " card-trash" : "");
          button.dataset.mailAction = action;
          var label = action === "read" ? "Mark " + (item.provider === "gmail" ? "conversation" : "message") + " as read" : "Move " + (item.provider === "gmail" ? "conversation to Trash" : "message to Deleted Items");
          button.title = label;
          button.setAttribute("aria-label", label + ": " + (item.subject || "(no subject)") + " for " + item.account);
          button.setAttribute("aria-disabled", String(pendingMailActions.has(item.key) || ["pending", "uncertain"].includes(mailActions[item.key]?.state) || (action === "read" && item.unread !== true)));
          button.appendChild(actionIcon(action));
          button.addEventListener("click", function () { if (button.getAttribute("aria-disabled") !== "true") void actOnMail(item.key, action); });
          quick.appendChild(button);
        });
        actionsRow.appendChild(quick);
        card.appendChild(actionsRow);

        messageList.appendChild(card);
        if (pendingMailActions.has(item.key)) card.setAttribute("aria-busy", "true");
        if (mailErrors[item.key]) {
          var error = document.createElement("p");
          error.className = "card-error";
          error.textContent = mailErrors[item.key];
          card.appendChild(error);
        }
        if (focusedKey === item.key) (card.querySelector('[data-mail-action="' + focusedAction + '"]') || open).focus();
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
    renderUndo();
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
    storageLocal()?.get("mailActions").then(function (data) {
      mailActions = data.mailActions || {};
      renderList();
      renderUndo();
    });
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
    var addFormGeneration = 0;
    function showAddForm(provider) {
      addFormGeneration++;
      addProvider = provider;
      addOpener = document.getElementById("add-" + provider);
      var isGmail = provider === "gmail";
      addTitle.textContent = isGmail ? "Add Gmail account" : "Add Outlook account";
      // Gmail reads the browser session; Outlook consent is handled by
      // the extension. The address registers which mailbox to poll.
      addNote.hidden = false;
      addNote.textContent = isGmail
        ? "Enter the Gmail address you are signed into in any tab, then press Add account."
        : "Enter your Outlook address, press Add account, then accept the Microsoft consent screen.";
      addHelpGmail.hidden = !isGmail;
      addHelpOutlook.hidden = isGmail;
      addError.hidden = true;
      addError.textContent = "";
      addForm.hidden = false;
      addEmail.focus();
    }
    function hideAddForm() {
      addFormGeneration++;
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
      var submit = document.getElementById("add-account-submit");
      if (!addProvider || submit.disabled) return;
      var generation = addFormGeneration;
      var draft = addEmail.value;
      var account = draft.trim();
      if (!account) {
        addError.textContent = "Enter your email address.";
        addError.hidden = false;
        return;
      }
      var result = await sendAction({type: "add-account", provider: addProvider, account}, submit);
      if (generation !== addFormGeneration || addEmail.value !== draft) return;
      if (result && result.ok) {
        addEmail.value = "";
        hideAddForm();
      } else {
        // Name the failing step instead of always blaming the address:
        // sign-in codes travel on the worker result, Gmail has no code
        // path and surfaces needsSignIn when its session is missing.
        var reason = "Could not add the account. Check the address and try again.";
        if (result && result.code === "flow-cancelled" && addProvider === "outlook") {
          reason = "The Microsoft sign-in was cancelled. Press Add account to try again.";
        } else if (result && result.code === "account-mismatch") {
          reason = "The signed-in account did not match that address. Check the address and try again.";
        } else if (result && result.needsSignIn && addProvider === "gmail") {
          reason = "Sign in to Gmail in a browser tab, then press Add account again.";
        } else if (result && result.needsSignIn) {
          reason = "Complete sign-in, then press Add account again.";
        }
        addError.textContent = reason;
        addError.hidden = false;
      }
    });
    document.getElementById("refresh-mail").addEventListener("click", function (event) {
      void sendAction({type: "refresh"}, event.currentTarget);
    });
    document.getElementById("empty-setup")?.addEventListener("click", function () { showView(true); });
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
          if (changes.mailActions) {
            mailActions = changes.mailActions.newValue || {};
            renderList();
            renderUndo();
          }
          if (changes[THEME_KEY] && !themeWrites) applyTheme(changes[THEME_KEY].newValue);
          if (changes[CACHE_KEY]) {
            var next = changes[CACHE_KEY].newValue;
            items = Array.isArray(next) ? next : [];
            settleMailFeedback();
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
