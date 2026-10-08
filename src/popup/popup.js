import { createHtmlMessage } from "./html-message.js";
import { messageBodyText } from "./message-body.js";
import { initPollSettings } from "./poll-settings-form.js";
import { initPollPresets } from "./poll-presets.js";
// A v5 inbox popup. Reads the normalized cache from chrome.storage.local
// key "mailCache" only (shape from src/store/cache.js):
// { key, provider, account, from, subject, snippet, date, unread, localRead }
// Keys include provider, encoded account, and message ID. Full message bodies
// are requested from the worker on expansion and held only for this popup.
// Per-account error rows (stale, offline, needs sign in) read the worker's
// "accountState" flags and recover via a "sign-in" runtime message.

import { THEME_KEY, DEFAULT_THEME, validTheme, loadTheme, saveTheme } from "./themes.js";
import { normalizeAccount, accountKey } from "../store/accounts.js";
import { threadUrl, accountInboxUrl } from "./links.js";
import { accountStatusLabel } from "../notify/notify.js";
import { normalizeSoundSettings, setMuted, setVolume, SOUND_SETTINGS_KEY, soundControlKeys } from "../notify/sound.js";

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
  // ({ needsSignIn, offline, backedOff, retryAt, status, code, reason } per
  // "provider:address"). Rendered as address-plus-code lines only — never
  // subject, snippet, or body. One failed account never hides the others.
  var ACCOUNT_STATE_KEY = "accountState";
  var accountState = {};
  // Sound settings mirror the worker's storage shape
  // ({ masterMuted, volume, mutedAccounts }) so both sides agree.
  var sound = { masterMuted: false, volume: 0.5, mutedAccounts: {} };
  var storageRevisions = new Map();

  function storageLocal() {
    return globalThis.chrome && chrome.storage ? chrome.storage.local : null;
  }

  function storageRevision(key) {
    return storageRevisions.get(key) || 0;
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
        renderStatus();
      }
      if (button) button.disabled = false;
    }
  }

  var pendingOpened = new Set();
  async function markRead(key) {
    var item = mailFeedback.get(key)?.item || items.find(function (item) { return item.key === key; });
    if (!item) return;
    var previousItem = { ...item };
    item.localRead = true;
    mailFeedback.delete(key);
    pendingOpened.add(key);
    renderHeader();
    renderList();
    try {
      // This records only the local opened-here flag; provider state is unchanged.
      var result = await chrome.runtime.sendMessage({ type: "mark-read", key: key });
      if (result?.ok) {
        for (var current of items) if (current.key === key) current.localRead = true;
        pendingOpened.delete(key);
        renderHeader();
        renderList();
        return;
      }
    } catch { /* Restore the card and report only the failed local update. */ }
    pendingOpened.delete(key);
    for (var current of items) if (current.key === key) current.localRead = previousItem.localRead;
    mailFeedback.set(key, { action: "failed", item: previousItem });
    mailErrors[key] = "Could not save the opened-here state. Try opening the message again.";
    setStatus(mailErrors[key], "error");
    renderHeader();
    renderList();
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
        (acct.enabled === false ? " · Paused" : stateLabel ? " · " + stateLabel.slice(acct.account.length + 3) : " · Connected");
      // Keep reconnection guidance local; shared removal guidance lives below
      // the list so ordinary account rows stay compact.
      var hint = document.createElement("small");
      hint.className = "account-hint";
      hint.hidden = !((accountState[row.dataset.accountKey] || {}).needsSignIn && acct.enabled !== false);
      hint.textContent = "Sign in reconnects this account.";
      var accState = accountState[accountKey(acct)] || {};
      var attention = acct.enabled !== false && (accState.needsSignIn || accState.offline || accState.backedOff);
      row.dataset.status = acct.enabled === false ? "paused" : attention ? "attention" : "ok";
      var avatar = document.createElement("span");
      avatar.className = "account-avatar";
      avatar.dataset.provider = acct.provider;
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = acct.account.charAt(0).toUpperCase();
      row.append(avatar, name, identity, actions, hint);
      var primary = acct.enabled !== false && !(accState.needsSignIn) ? ["Sign out", "sign-out"] : ["Sign in", "sign-in"];
      [primary, ["Remove", "remove-account"]].forEach(function (entry) {
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
          : "Remove " + acct.account;
        button.setAttribute("aria-label", entry[0] + " " + acct.account);
        if (entry[1] === "remove-account") button.setAttribute("aria-describedby", "account-remove-note");
        button.addEventListener("click", function () {
          void sendAction({type: entry[1], provider: acct.provider, account: acct.account}, button);
        });
        if (entry[1] === "remove-account") {
          button.textContent = "";
          button.classList.add("account-remove");
          var xs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          xs.setAttribute("viewBox", "0 0 24 24"); xs.setAttribute("aria-hidden", "true");
          var xp = document.createElementNS("http://www.w3.org/2000/svg", "path");
          xp.setAttribute("d", "M6 6l12 12M18 6 6 18"); xs.appendChild(xp); button.appendChild(xs);
        }
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

  // Accordion: opening one card closes the others. Expanded unread cards also
  // stage the existing reversible read interaction.
  var expandedKeys = new Set();
  var cardToggles = new Map();
  var messageBodies = new Map();
  var accountSections = new Map();
  function currentMailItem(key) {
    return displayedItems().find(function (item) { return item.key === key; })
      || items.find(function (item) { return item.key === key; })
      || stagedReads.get(key)?.item
      || mailFeedback.get(key)?.item;
  }
  function showMessageBody(card, key) {
    var body = card.querySelector(".card-body");
    if (!body) return;
    body.replaceChildren();
    var state = messageBodies.get(key);
    card.classList.toggle("has-body", state?.text !== undefined);
    body.setAttribute("aria-busy", String(state?.loading === true));
    if (state?.text !== undefined) {
      if (state.contentType === "html" && state.content) {
        body.appendChild(createHtmlMessage(state.content, document, {
          onEscape: function () {
            var current = cardToggles.get(key);
            if (current) { toggleCard(current.card, current.toggle, key, false); current.toggle.focus(); }
          },
          onReading: function (input) {
            markCardReading(key, input);
          },
          onLink: function (url) { void chrome.tabs.create({ url: url, active: true }); },
        }));
      } else body.textContent = state.text || "This message has no text content.";
    } else {
      var status = document.createElement("p");
      status.setAttribute("role", "status");
      status.textContent = state?.loading ? "Loading full message…" : "Could not load the full message.";
      body.appendChild(status);
      if (!state?.loading) {
        var retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = "Retry";
        retry.addEventListener("click", function (event) {
          event.stopPropagation();
          loadMessageBody(key);
        });
        body.appendChild(retry);
      }
    }
  }
  function purgeMessageBody(key) {
    var record = cardToggles.get(key);
    record?.body?.replaceChildren();
    record?.card?.classList.remove("expanded", "has-body");
    record?.body?.setAttribute("aria-busy", "false");
    if (record) record.toggle.setAttribute("aria-expanded", "false");
    messageBodies.delete(key);
    expandedKeys.delete(key);
  }
  async function loadMessageBody(key) {
    var previous = messageBodies.get(key);
    if (previous?.loading || previous?.text !== undefined) return;
    var state = { loading: true };
    messageBodies.set(key, state);
    var card = cardToggles.get(key)?.card;
    if (card) showMessageBody(card, key);
    try {
      var result = await chrome.runtime.sendMessage({ type: "message-body", key: key });
      if (messageBodies.get(key) !== state) return;
      if (!result?.ok || typeof result.content !== "string" || !["text", "html"].includes(result.contentType)) throw Error();
      state.text = messageBodyText(result.content, result.contentType, document);
      state.content = result.content;
      state.contentType = result.contentType;
    } catch { /* Retry stays available without exposing provider errors. */ }
    state.loading = false;
    card = cardToggles.get(key)?.card;
    if (card) showMessageBody(card, key);
  }
  function toggleCard(card, toggle, key, force) {
    var on = force !== undefined ? force : !card.classList.contains("expanded");
    if (on) {
      expandedKeys.forEach(function (otherKey) {
        if (otherKey === key) return;
        var other = cardToggles.get(otherKey);
        if (other) {
          other.card.classList.remove("expanded");
          other.toggle.setAttribute("aria-expanded", "false");
          other.toggle.setAttribute("aria-label", "Expand: " + (other.subjectLabel || "(no subject)"));
        }
      });
      expandedKeys.clear();
      expandedKeys.add(key);
    } else expandedKeys.delete(key);
    var record = cardToggles.get(key) || {};
    record.card = card;
    record.toggle = toggle;
    record.subjectLabel = toggle.dataset.subject;
    cardToggles.set(key, record);
    card.classList.toggle("expanded", on);
    toggle.setAttribute("aria-expanded", String(on));
    return on;
  }

  function visibleItems() {
    var sorted = displayedItems().sort(function (a, b) { return b.date - a.date; });
    if (filter === "all") return sorted;
    return sorted.filter(function (item) { return item.provider === filter; });
  }

  // The extension counts its displayed unread state, including local opens.
  function unreadCount(list) {
    return list.filter(isUnread).length;
  }
  function renderHeader() {
    var keys = new Set(configuredAccounts.map(accountKey));
    var scoped = displayedItems().filter(function (item) { return keys.has(accountKey(item)); });
    var unread = unreadCount(scoped);
    var el = document.getElementById("unread-count");
    el.textContent = unread > 0 ? String(unread) : "";
    el.title = unread + " unread";
    el.setAttribute("aria-label", unread + " unread");
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
  var mailActionsRevision = 0;
  async function syncMailActions() {
    var revision = ++mailActionsRevision;
    try {
      var data = await storageLocal()?.get("mailActions");
      if (revision !== mailActionsRevision) return;
      mailActions = data?.mailActions || {};
      renderList();
      renderRecovery();
    } catch { /* Keep the saved recovery view if local storage is unavailable. */ }
  }
  // Project pending actions over authoritative cache; never write optimistic mail state.
  var mailFeedback = new Map();
  var stagedReads = new Map();
  var hoveredCards = new Set();
  var keyboardMode = true;
  function pauseStagedRead(key) {
    var staged = stagedReads.get(key);
    if (staged?.timer != null) clearTimeout(staged.timer);
    if (staged) staged.timer = null;
  }
  function scheduleStagedRead(key) {
    var staged = stagedReads.get(key);
    if (!staged) return;
    var active = document.activeElement;
    var cardHasFocus = active?.closest?.('.card')?.dataset.key === key;
    var readingFrameHasFocus = active?.classList?.contains("message-frame") && cardHasFocus;
    if (hoveredCards.has(key) || (keyboardMode && cardHasFocus) || readingFrameHasFocus) {
      pauseStagedRead(key);
    } else if (staged.timer == null) {
      staged.timer = setTimeout(function () { commitStagedRead(key); }, 5000);
    }
  }
  function markCardReading(key, input) {
    if (!key) return;
    keyboardMode = input === "keyboard";
    if (input === "pointer") {
      hoveredCards.clear();
      hoveredCards.add(key);
    }
    scheduleStagedRead(key);
  }
  function commitStagedRead(key) {
    var staged = stagedReads.get(key);
    if (!staged) return;
    pauseStagedRead(key);
    stagedReads.delete(key);
    hoveredCards.delete(key);
    void actOnMail(key, "read", staged.item);
  }
  function commitOtherReads(key) {
    Array.from(stagedReads.keys()).forEach(function (other) {
      if (other !== key) commitStagedRead(other);
    });
  }
  function cancelStagedRead(key) {
    pauseStagedRead(key);
    stagedReads.delete(key);
    renderHeader();
    renderList();
  }
  function stageRead(key) {
    if (stagedReads.has(key) || pendingMailActions.has(key) || ["pending", "uncertain"].includes(mailActions[key]?.state)) return;
    var item = mailFeedback.get(key)?.item || items.find(function (item) { return item.key === key; });
    if (!item) return;
    mailFeedback.delete(key);
    delete mailErrors[key];
    stagedReads.set(key, { item: { ...item }, timer: null });
    renderHeader();
    renderList();
    scheduleStagedRead(key);
  }
  function settleMailFeedback() {
    mailFeedback.forEach(function (feedback, key) {
      var current = items.find(function (item) { return item.key === key; });
      if (feedback.confirmed && feedback.action === "unread" && current && current.unread !== false) {
        mailFeedback.delete(key);
      } else if (feedback.confirmed && feedback.action === "read" && !(current && current.unread !== false)) {
        mailFeedback.delete(key);
      }
    });
  }
  function displayedItems() {
    // Staged reads remain reversible; committed reads hide during the write.
    // Failed reads retain a recovery card even if the cache already changed.
    // Unread feedback still shows.
    var projected = items.filter(function (item) {
      var feedback = mailFeedback.get(item.key);
      if (pendingOpened.has(item.key)) return false;
      if (stagedReads.has(item.key)) return true;
      if (feedback) return feedback.action === "unread" || feedback.action === "failed";
      // The worker preserves the local opened-here flag across polls.
      if (item.localRead === true) return false;
      return item.unread !== false;
    }).map(function (item) {
      var feedback = mailFeedback.get(item.key);
      if (stagedReads.has(item.key)) return { ...item, unread: false, localRead: false };
      if (feedback && feedback.action === "failed") return { ...item, unread: feedback.item.unread, localRead: feedback.item.localRead };
      if (feedback && feedback.action === "unread") return { ...item, unread: true, localRead: false };
      return mailFeedback.has(item.key) ? { ...item, unread: false, localRead: false } : item;
    });
    // The worker may remove/cache-read mail before reporting an uncertain result.
    // Retain a recovery card without writing optimistic state into storage.
    var projectedKeys = new Set(projected.map(function (item) { return item.key; }));
    mailFeedback.forEach(function (feedback, key) {
      if (feedback.action === "failed" && !pendingOpened.has(key) && !projectedKeys.has(key)) {
        projected.push({ ...feedback.item });
        projectedKeys.add(key);
      }
    });
    stagedReads.forEach(function (staged, key) {
      if (!projectedKeys.has(key)) {
        projected.push({ ...staged.item, unread: false, localRead: false });
        projectedKeys.add(key);
      }
    });
    return projected;
  }
  var mailErrors = {};
  function actionIcon(kind) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", kind === "read" ? "M3 8l9 6 9-6M3 8l9-5 9 5v12H3V8M8 17l2 2 4-4" : kind === "open" ? "M14 4h6v6M20 4L11 13M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" : "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7");
    svg.appendChild(path);
    return svg;
  }
  function updateMailButton(button, item, action) {
    var isToggle = action === "read";
    var isOpen = action === "open";
    var readState = !isUnread(item);
    var gmailUnreadBlocked = isToggle && readState && item.provider === "gmail" && !stagedReads.has(item.key);
    var label = isOpen
      ? "Open " + (item.subject || "(no subject)") + " in " + (item.provider === "outlook" ? "Outlook" : "Gmail") + " for " + item.account + " (marks opened here, provider unchanged)"
      : isToggle
        ? "Mark " + (item.provider === "gmail" ? "conversation" : "message") + (readState ? " as unread" : " as read")
        : "Move " + (item.provider === "gmail" ? "conversation to Trash" : "message to Deleted Items");
    button.className = "card-icon" + (action === "trash" ? " card-trash" : "") + (isToggle && readState ? " card-icon-active" : "");
    button.title = isOpen
      ? "Opens the provider message and marks opened here (provider unread unchanged)"
      : gmailUnreadBlocked ? "Marking unread is not available for Gmail yet" : label;
    if (isToggle) button.setAttribute("aria-pressed", String(readState));
    else button.removeAttribute("aria-pressed");
    button.setAttribute("aria-label", isOpen ? label : label + ": " + (item.subject || "(no subject)") + " for " + item.account);
    button.setAttribute("aria-disabled", String(pendingMailActions.has(item.key) || ["pending", "uncertain"].includes(mailActions[item.key]?.state) || gmailUnreadBlocked));
  }
  function updateCard(record, item) {
    var card = record.card;
    var read = !isUnread(item);
    record.item = item;
    card.classList.toggle("read", read);
    card.classList.toggle("expanded", expandedKeys.has(item.key));
    card.setAttribute("data-key", item.key);
    card.removeAttribute("aria-busy");
    if (pendingMailActions.has(item.key)) card.setAttribute("aria-busy", "true");
    record.toggle.dataset.subject = item.subject || "(no subject)";
    record.toggle.setAttribute("aria-expanded", String(expandedKeys.has(item.key)));
    record.toggle.setAttribute("aria-label", (expandedKeys.has(item.key) ? "Collapse: " : "Expand: ") + (item.subject || "(no subject)"));
    record.sender.textContent = item.from || "Unknown sender";
    record.subjectElement.textContent = item.subject || "(no subject)";
    record.subjectLabel = item.subject || "(no subject)";
    record.snippet.textContent = item.snippet || "";
    record.time.textContent = formatTime(item.date);
    if (!read && !record.dot) {
      record.dot = document.createElement("span");
      record.dot.className = "unread-dot";
      record.dot.setAttribute("role", "img");
      record.dot.setAttribute("aria-label", "Unread");
      card.insertBefore(record.dot, card.firstChild);
    } else if (read && record.dot) {
      record.dot.remove();
      record.dot = null;
    }
    if (item.unread === true && item.localRead === true && !record.openedTag) {
      record.openedTag = document.createElement("span");
      record.openedTag.className = "opened-tag";
      record.openedTag.textContent = "Opened here";
      record.topline.insertBefore(record.openedTag, record.time);
    } else if (!(item.unread === true && item.localRead === true) && record.openedTag) {
      record.openedTag.remove();
      record.openedTag = null;
    }
    ["open", "read", "trash"].forEach(function (action) { updateMailButton(record.buttons[action], item, action); });
    var error = mailErrors[item.key];
    if (error && !record.error) {
      record.error = document.createElement("p");
      record.error.className = "card-error";
      card.appendChild(record.error);
    }
    if (record.error) {
      if (error) record.error.textContent = error;
      else { record.error.remove(); record.error = null; }
    }
  }
  function activateCardToggle(event, card, toggle, key, keyboard) {
    if (keyboard) {
      keyboardMode = true;
      event.preventDefault();
    }
    var current = currentMailItem(key);
    if (!current) return;
    commitOtherReads(current.key);
    var expanded = toggleCard(card, toggle, current.key);
    if (expanded && isUnread(current)) stageRead(current.key);
    if (expanded) void loadMessageBody(current.key);
  }
  async function actOnMail(key, action, snapshot) {
    if (pendingMailActions.has(key)) return;
    var actionItem = snapshot || mailFeedback.get(key)?.item || items.find(function (item) { return item.key === key; }) || mailActions[key]?.item;
    var unconfirmedMessage = "The result could not be confirmed. Check this action in your mailbox, then choose “I’ve checked” to unlock it. Other mail is still available.";
    pendingMailActions.add(key);
    delete mailErrors[key];
    // Read applies instantly: mailFeedback hides the card while the provider
    // write runs in the background. Only failures surface (card repopulates
    // with the error). Success stays silent.
    var optimisticRead = action === "read";
    if (action === "read" || action === "trash" || action === "unread") mailFeedback.set(key, { action: action, item: actionItem, confirmed: false });
    if (!optimisticRead) setStatus(action === "unread" ? "Marking as unread…" : action === "trash" ? "Moving to Trash…" : "Updating mailbox…", "progress");
    renderHeader();
    renderList();
    renderRecovery();
    try {
      var result = await chrome.runtime.sendMessage({ type: "mail-action", key: key, action: action });
      if (!result?.ok) {
        if (action === "read" && actionItem) mailFeedback.set(key, { action: "failed", item: actionItem });
        else mailFeedback.delete(key);
        var code = result?.code;
        mailErrors[key] = code === "check-mailbox" ? unconfirmedMessage
          : code === "gmail-changed" ? "Gmail’s session interface changed. Open Gmail to manage this conversation."
          : code === "undo-expired" ? "Undo is no longer available here. Check your mailbox; the mail may already be restored. If it is still in Trash, restore it there."
          : code === "sign-in" ? "Sign in to this account in Settings, then try again."
          : code === "pending" ? "This action is already queued. Wait for it to finish."
          : "Could not complete the action. The mailbox service is unavailable or rejected the request. Check your mailbox before trying again.";
        setStatus(mailErrors[key], "error");
      } else {
        if (mailFeedback.has(key)) mailFeedback.get(key).confirmed = true;
        if (action === "undo") mailFeedback.delete(key);
        settleMailFeedback();
        var unreadMessage = actionItem?.provider === "gmail"
          ? "Marked as unread in Gmail. If an open Gmail page still shows read, refresh that page."
          : "Marked as unread in your mailbox.";
        // Reads stay silent on success; other actions keep their feedback.
        if (action !== "read") setStatus(action === "acknowledge" ? "This action is unlocked. Refresh to check your inbox." : action === "unread" ? unreadMessage : action === "trash" ? "Moved to Trash." : "Restored to your inbox.", "ok");
      }
    } catch {
      if (action === "read" && actionItem) mailFeedback.set(key, { action: "failed", item: actionItem });
      else mailFeedback.delete(key);
      mailErrors[key] = unconfirmedMessage;
      setStatus(mailErrors[key], "error");
    } finally {
      await syncMailActions();
      pendingMailActions.delete(key);
      renderHeader();
      renderList();
      renderRecovery();
    }
  }
  var pendingRecoveryAccounts = new Set();
  async function acknowledgeAccount(acctKey, entries, address) {
    if (pendingRecoveryAccounts.has(acctKey)) return;
    pendingRecoveryAccounts.add(acctKey);
    setStatus("Unlocking checked actions…", "progress");
    renderRecovery();
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
      renderRecovery();
    }
  }
  function renderRecovery() {
    var list = document.getElementById("mail-undo");
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
    list.hidden = !list.childElementCount;
  }

  function renderList() {
    var list = document.getElementById("inbox-list");
    var empty = document.getElementById("inbox-empty");
    var active = document.activeElement;
    var focusedKey = active?.closest?.(".card")?.getAttribute("data-key");
    var focusedAction = active?.dataset.mailAction;
    var focusedToggle = active?.classList?.contains("card-toggle") === true;
    var focusedInbox = active?.dataset.inboxAccount;
    var focusedRecovery = active?.closest?.(".status-signin")?.dataset.accountKey;
    var hadListFocus = list.contains(active);
    var recoveryFocus = null;
    var index = 0;
    var shown = visibleItems();
    var sections = configuredAccounts.filter(function (acct) { return filter === "all" || acct.provider === filter; });
    var sectionKeys = new Set(sections.map(accountKey));
    var configuredKeys = new Set(configuredAccounts.map(accountKey));
    var mailByAccount = new Map();
    shown.forEach(function (item) {
      var key = accountKey(item);
      if (!mailByAccount.has(key)) mailByAccount.set(key, []);
      mailByAccount.get(key).push(item);
    });
    var activeReaderKey = Array.from(expandedKeys).find(function (key) {
      var record = cardToggles.get(key);
      return record?.card?.isConnected && sectionKeys.has(accountKey(record.item || currentMailItem(key) || {}));
    });
    var preserveLayout = Boolean(activeReaderKey);
    empty.hidden = sections.length !== 0;
    empty.textContent = configuredAccounts.length ? "No accounts match this filter." : "No accounts yet. Open Settings to connect Gmail or Outlook.";
    var setupCta = document.getElementById("empty-setup");
    if (setupCta) setupCta.hidden = configuredAccounts.length !== 0;
    accountSections.forEach(function (group, key) {
      if (sectionKeys.has(key)) return;
      if (!configuredKeys.has(key)) {
        group.querySelectorAll(".card").forEach(function (card) {
          var mailKey = card.getAttribute("data-key");
          pauseStagedRead(mailKey);
          stagedReads.delete(mailKey);
          hoveredCards.delete(mailKey);
          purgeMessageBody(mailKey);
          cardToggles.delete(mailKey);
        });
      }
      group.remove();
      accountSections.delete(key);
    });
    if (!preserveLayout) {
      for (var [key, record] of cardToggles) {
        if (record.card.isConnected) continue;
        if (!items.some(function (item) { return item.key === key; })
          && !stagedReads.has(key) && !mailFeedback.has(key)) {
          cardToggles.delete(key);
          messageBodies.delete(key);
          expandedKeys.delete(key);
        }
      }
    }
    sections.forEach(function (acct, sectionIndex) {
      var acctKey = accountKey(acct);
      var group = accountSections.get(acctKey);
      var isNewSection = !group;
      if (!group) {
        group = document.createElement("li");
        group.className = "account-section";
        group.dataset.accountKey = acctKey;
        accountSections.set(acctKey, group);
      }
      var heading = document.createElement("header");
      heading.className = "account-heading";
      var top = document.createElement("div");
      top.className = "account-heading-top";
      var badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = acct.provider === "outlook" ? "Outlook" : "Gmail";
      var mail = mailByAccount.get(acctKey) || [];
      // Freshness comes from the worker-persisted per-account stamp, so a
      // failed or paused account can never display a fresh check time.
      var acctState = { ...(accountState[accountKey(acct)] || {}) };
      if (typeof navigator !== "undefined" && navigator.onLine === false && !acctState.needsSignIn) acctState.offline = true;
      var count = document.createElement("span");
      count.className = "account-count";
      var unread = unreadCount(mail);
      count.textContent = String(unread);
      count.title = unread + " unread";
      count.setAttribute("aria-label", unread + " unread");
      if (!unread) count.dataset.zero = "";
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
      var inboxUrl = accountInboxUrl(acct);
      if (inboxUrl) {
        var inbox = document.createElement("a");
        inbox.className = "account-inbox";
        inbox.href = inboxUrl;
        inbox.target = "_blank";
        inbox.rel = "noreferrer";
        inbox.dataset.inboxAccount = accountKey(acct);
        inbox.title = "Open inbox for " + acct.account;
        inbox.append(top, address);
        inbox.addEventListener("click", function (event) {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || (event.button && event.button !== 0) || !globalThis.chrome?.tabs?.create) return;
          event.preventDefault();
          void chrome.tabs.create({ url: inboxUrl, active: true });
        });
        heading.appendChild(inbox);
      } else heading.append(top, address);
      var state = acctState;
      var status = acct.enabled === false ? "Paused" : accountStatusLabel(acct, state);
      var note = null;
      if (status) {
        note = document.createElement("div");
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
      }
      var messageList = group.querySelector(".account-mail");
      if (!messageList) {
        messageList = document.createElement("ul");
        messageList.className = "account-mail";
      }
      if (isNewSection) {
        group.appendChild(heading);
        if (note) group.appendChild(note);
        group.appendChild(messageList);
        var nextGroup = null;
        if (preserveLayout) {
          for (var following = sectionIndex + 1; following < sections.length; following++) {
            var followingGroup = accountSections.get(accountKey(sections[following]));
            if (followingGroup?.parentNode === list) { nextGroup = followingGroup; break; }
          }
        }
        list.insertBefore(group, nextGroup);
      } else {
        var oldHeading = group.querySelector(".account-heading");
        if (oldHeading) oldHeading.replaceWith(heading);
        else group.insertBefore(heading, messageList);
        var oldNote = group.querySelector(".account-note");
        if (note) {
          if (oldNote) oldNote.replaceWith(note);
          else group.insertBefore(note, messageList);
        } else if (oldNote) oldNote.remove();
      }
      if (focusedInbox === accountKey(acct) && inboxUrl) inbox.focus();
      if (!mail.length) {
        var noMail = group.querySelector(".account-empty");
        if (!noMail) {
          noMail = document.createElement("p");
          noMail.className = "account-empty";
          group.appendChild(noMail);
        }
        // A checked empty mailbox reads differently from missing data.
        noMail.textContent = (!status && state.checkedAt) ? "All caught up." : "No messages to show.";
      } else {
        group.querySelector(".account-empty")?.remove();
      }
      var desiredCardKeys = new Set(mail.map(function (item) { return item.key; }));
      Array.from(messageList.querySelectorAll(".card")).forEach(function (oldCard) {
        var oldKey = oldCard.getAttribute("data-key");
        if (desiredCardKeys.has(oldKey)) return;
        oldCard.remove();
        pauseStagedRead(oldKey);
        purgeMessageBody(oldKey);
        cardToggles.delete(oldKey);
        stagedReads.delete(oldKey);
        hoveredCards.delete(oldKey);
      });
      mail.forEach(function (item, mailIndex) {
        var existing = cardToggles.get(item.key);
        if (existing?.card?.parentNode === messageList) {
          updateCard(existing, item);
          return;
        }
        var card = document.createElement("li");
        card.className = "card";
        card.addEventListener("mouseenter", function () {
          hoveredCards.add(item.key);
          pauseStagedRead(item.key);
        });
        card.addEventListener("mouseleave", function () {
          hoveredCards.delete(item.key);
          scheduleStagedRead(item.key);
        });
        card.addEventListener("focusin", function () { scheduleStagedRead(item.key); });
        card.addEventListener("focusout", function () {
          queueMicrotask(function () { scheduleStagedRead(item.key); });
        });
        // The toggle owns sender/subject/snippet; icon and Open buttons
        // stay siblings so nesting stays valid. Clicking elsewhere on the
        // card delegates to the toggle; expansion stages unread mail for the
        // existing reversible read interaction.
        // Preview and footer actions are separate controls. Native button
        // activation must never pass through the preview's key handler.
        var toggle = document.createElement("div");
        toggle.className = "card-toggle";
        toggle.setAttribute("role", "button");
        toggle.setAttribute("tabindex", "0");
        var top = document.createElement("span");
        top.className = "card-top";
        var topline = document.createElement("span");
        topline.className = "card-topline";

        var sender = document.createElement("span");
        sender.className = "card-sender";
        topline.appendChild(sender);

        // The footer reserves stable action space without shortening sender
        // names. Hover and keyboard focus reveal the same native buttons.
        var icons = document.createElement("span");
        icons.className = "card-icons";
        var mailButtons = {};
        ["open", "read", "trash"].forEach(function (action) {
          var button = document.createElement("button");
          button.type = "button";
          // The read control is a toggle: unread mail sends read, mail marked
          // read here can be cancelled before commitment. Gmail reversal is
          // local during that grace period; provider unread remains blocked.
          var isToggle = action === "read";
          var isOpen = action === "open";
          button.dataset.mailAction = action;
          button.appendChild(actionIcon(action));
          mailButtons[action] = button;
          button.addEventListener("click", function (event) {
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            var current = currentMailItem(item.key);
            if (!current) return;
            commitOtherReads(current.key);
            if (button.getAttribute("aria-disabled") === "true") return;
            if (isOpen) {
              if (stagedReads.has(current.key)) cancelStagedRead(current.key);
              void markRead(current.key);
              openUrl(threadUrl(current));
            } else if (isToggle && stagedReads.has(current.key) && !isUnread(current)) {
              cancelStagedRead(current.key);
            } else if (isToggle && isUnread(current)) {
              stageRead(current.key);
            } else {
              if (stagedReads.has(current.key)) cancelStagedRead(current.key);
              void actOnMail(current.key, isToggle ? "unread" : action, current);
            }
          });
          icons.appendChild(button);
        });
        var time = document.createElement("span");
        time.className = "card-time";
        topline.appendChild(time);
        top.appendChild(topline);
        toggle.appendChild(top);
        var subject = document.createElement("span");
        subject.className = "card-subject";
        toggle.appendChild(subject);

        var snippet = document.createElement("span");
        snippet.className = "card-snippet";
        toggle.appendChild(snippet);
        card.appendChild(toggle);
        card.appendChild(icons);
        var body = document.createElement("div");
        body.className = "card-body";
        body.tabIndex = 0;
        body.setAttribute("role", "region");
        body.setAttribute("aria-label", "Full message");
        card.appendChild(body);
        var record = { card: card, toggle: toggle,
          sender: sender, subjectElement: subject, snippet: snippet, time: time, topline: topline,
          body: body, dot: null, openedTag: null,
          buttons: mailButtons, error: null };
        cardToggles.set(item.key, record);
        if (expandedKeys.has(item.key)) showMessageBody(card, item.key);
        toggle.addEventListener("click", function (event) {
          activateCardToggle(event, card, toggle, item.key, false);
        });
        toggle.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ")
            activateCardToggle(event, card, toggle, item.key, true);
        });
        card.addEventListener("keydown", function (event) {
          if (event.key === "Escape" && card.classList.contains("expanded")) toggleCard(card, toggle, item.key, false);
        });

        var nextCard = null;
        if (preserveLayout) {
          for (var nextIndex = mailIndex + 1; nextIndex < mail.length; nextIndex++) {
            var nextRecord = cardToggles.get(mail[nextIndex].key);
            if (nextRecord?.card?.parentNode === messageList) { nextCard = nextRecord.card; break; }
          }
        }
        messageList.insertBefore(card, nextCard);
        updateCard(record, item);
        if (focusedKey === item.key) {
          var restore = focusedToggle ? toggle : card.querySelector('[data-mail-action="' + focusedAction + '"]') || card.querySelector('[data-mail-action="open"]') || toggle;
          restore.focus();
        }
      });
      if (!preserveLayout) {
        var orderedCards = mail.map(function (item) { return cardToggles.get(item.key)?.card; }).filter(Boolean);
        orderedCards.forEach(function (card, cardIndex) {
          var current = messageList.children[cardIndex] || null;
          if (current !== card) messageList.insertBefore(card, current);
        });
      }
    });
    if (!preserveLayout) {
      var orderedGroups = sections.map(function (acct) { return accountSections.get(accountKey(acct)); }).filter(Boolean);
      orderedGroups.forEach(function (group, groupIndex) {
        var current = list.children[groupIndex] || null;
        if (current !== group) list.insertBefore(group, current);
      });
    }
    stagedReads.forEach(function (_, key) { scheduleStagedRead(key); });
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
      description.className = "chime-text";
      var m = /^(.*) \((gmail|outlook)\)$/.exec(entry.label);
      var addr = document.createElement("span");
      addr.className = "chime-name";
      addr.textContent = m ? m[1] : entry.label;
      var prov = document.createElement("small");
      prov.textContent = m ? (m[2] === "outlook" ? "Outlook chime" : "Gmail chime") : "Chime";
      description.append(addr, prov);
      label.appendChild(description);
      li.appendChild(label);
      list.appendChild(li);
      if (entry.key === focusedKey) box.focus();
    });
    if (focusedKey && !list.contains(document.activeElement)) master.focus();
  }

  function render() {
    renderAccounts();
    renderHeader();
    renderPills();
    renderList();
    renderRecovery();
    renderSound();
  }

  function renderStatus() {
    renderAccounts();
    renderList();
  }

  function clearUnavailableReaders() {
    var readerKeys = new Set([...stagedReads.keys(), ...messageBodies.keys(), ...expandedKeys]);
    readerKeys.forEach(function (key) {
      var item = cardToggles.get(key)?.item || currentMailItem(key);
      var account = item && configuredAccounts.find(function (acct) { return accountKey(acct) === accountKey(item); });
      if (!account || account.enabled === false) {
        pauseStagedRead(key);
        stagedReads.delete(key);
        hoveredCards.delete(key);
        purgeMessageBody(key);
      }
    });
  }

  function clearSignedOutReaders() {
    var discardedBody = false;
    var readerKeys = new Set([...messageBodies.keys(), ...expandedKeys]);
    readerKeys.forEach(function (key) {
      var item = cardToggles.get(key)?.item || currentMailItem(key);
      if (item && accountState[accountKey(item)]?.signedOut) {
        discardedBody = true;
        pauseStagedRead(key);
        stagedReads.delete(key);
        hoveredCards.delete(key);
        purgeMessageBody(key);
      }
    });
    return discardedBody;
  }

  function load() {
    var store = storageLocal();
    if (!store) {
      items = [];
      configuredAccounts = [];
      accountState = {};
      mailActions = {};
      sound = normalizeSoundSettings();
      render();
      return;
    }
    var keys = [CACHE_KEY, ACCOUNTS_KEY, ACCOUNT_STATE_KEY, "mailActions", SOUND_SETTINGS_KEY];
    var revisions = new Map(keys.map(function (key) { return [key, storageRevision(key)]; }));
    var actionRevision = mailActionsRevision;
    Promise.resolve(store.get(keys)).then(function (data) {
      if (storageRevision(CACHE_KEY) === revisions.get(CACHE_KEY)) {
        var cached = data?.[CACHE_KEY];
        items = Array.isArray(cached) ? cached : [];
      }
      if (storageRevision(ACCOUNTS_KEY) === revisions.get(ACCOUNTS_KEY)) {
        var accounts = data?.[ACCOUNTS_KEY];
        configuredAccounts = Array.isArray(accounts) ? accounts.map(normalizeAccount) : [];
      }
      if (storageRevision(ACCOUNT_STATE_KEY) === revisions.get(ACCOUNT_STATE_KEY)) {
        var state = data?.[ACCOUNT_STATE_KEY];
        accountState = state && typeof state === "object" ? state : {};
      }
      if (storageRevision("mailActions") === revisions.get("mailActions") && actionRevision === mailActionsRevision) {
        mailActions = data?.mailActions || {};
      }
      if (storageRevision(SOUND_SETTINGS_KEY) === revisions.get(SOUND_SETTINGS_KEY))
        sound = normalizeSoundSettings(data?.[SOUND_SETTINGS_KEY]);
      clearUnavailableReaders();
      clearSignedOutReaders();
      render();
    }).catch(function () { render(); });
  }

  function showView(settings) {
    var mail = document.getElementById("mail-view");
    var view = document.getElementById("settings-view");
    if (settings && !mail.hidden) mailScroll = mail.scrollTop;
    mail.hidden = settings;
    view.hidden = !settings;
    renderRecovery();
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
    document.querySelectorAll('[name="popup-theme"]').forEach(function (radio) {
      radio.checked = radio.value === selected;
      radio.closest(".theme-choice")?.setAttribute("data-selected", String(radio.checked));
    });
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
    // Reconcile hover from live pointer targets after cache renders replace cards.
    document.addEventListener("pointermove", function (event) {
      var key = event.target?.closest?.('.card')?.dataset.key;
      hoveredCards.clear();
      if (key) hoveredCards.add(key);
      stagedReads.forEach(function (_, stagedKey) { scheduleStagedRead(stagedKey); });
    });
    document.addEventListener("pointerout", function (event) {
      if (event.relatedTarget) return;
      hoveredCards.clear();
      stagedReads.forEach(function (_, key) { scheduleStagedRead(key); });
    });
    document.addEventListener("wheel", function (event) {
      var key = event.target?.closest?.(".card")?.dataset.key;
      if (!key && document.activeElement?.classList?.contains("message-frame"))
        key = document.activeElement.closest?.(".card")?.dataset.key;
      markCardReading(key, "pointer");
    }, { capture: true, passive: true });
    document.addEventListener("scroll", function (event) {
      var key = event.target?.closest?.(".card")?.dataset.key;
      if (key) markCardReading(key, "pointer");
    }, true);
    document.addEventListener("pointerdown", function () {
      keyboardMode = false;
      stagedReads.forEach(function (_, key) { scheduleStagedRead(key); });
    });
    document.addEventListener("keydown", function () {
      keyboardMode = true;
      stagedReads.forEach(function (_, key) { scheduleStagedRead(key); });
    });
    document.addEventListener("click", function (event) {
      commitOtherReads(event.target?.closest?.('.card')?.dataset.key);
    });
    window.addEventListener("pagehide", function () { commitOtherReads(); });
    window.addEventListener("blur", function () {
      // Focusing the child document blurs this window while the popup stays open.
      setTimeout(function () {
        if (document.activeElement?.classList?.contains("message-frame")) return;
        commitOtherReads();
      }, 0);
    });
    var pollPresets = initPollPresets();
    var pollSettings = initPollSettings({ onFill: () => pollPresets?.sync() });
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
        if (area !== "local" || !changes) return;
        Object.keys(changes).forEach(function (key) {
          storageRevisions.set(key, storageRevision(key) + 1);
        });
        if (changes.pollIntervalMs) pollSettings.changed(changes.pollIntervalMs.newValue);
        if (changes[THEME_KEY] && !themeWrites) applyTheme(changes[THEME_KEY].newValue);

        var renderAll = Boolean(changes[CACHE_KEY] || changes[ACCOUNTS_KEY]);
        var renderStatusOnly = false;
        var renderActions = false;
        var renderSoundOnly = Boolean(changes[SOUND_SETTINGS_KEY]);
        if (changes[CACHE_KEY]) {
          var next = changes[CACHE_KEY].newValue;
          items = Array.isArray(next) ? next : [];
        }
        if (changes[ACCOUNTS_KEY]) {
          var accounts = changes[ACCOUNTS_KEY].newValue;
          configuredAccounts = Array.isArray(accounts) ? accounts.map(normalizeAccount) : [];
        }
        if (changes[ACCOUNT_STATE_KEY]) {
          var state = changes[ACCOUNT_STATE_KEY].newValue;
          accountState = state && typeof state === "object" ? state : {};
          renderStatusOnly = true;
        }
        if (changes["mailActions"]) {
          mailActionsRevision++;
          mailActions = changes["mailActions"].newValue || {};
          renderActions = true;
        }
        if (changes[SOUND_SETTINGS_KEY]) sound = normalizeSoundSettings(changes[SOUND_SETTINGS_KEY].newValue);
        if (changes[CACHE_KEY]) settleMailFeedback();
        if (changes[ACCOUNTS_KEY]) clearUnavailableReaders();
        if (changes[ACCOUNT_STATE_KEY] && clearSignedOutReaders()) renderAll = true;

        if (renderAll) render();
        else {
          if (renderStatusOnly) renderStatus();
          else if (renderActions) renderList();
          if (renderActions) renderRecovery();
          if (renderSoundOnly) renderSound();
        }
      });
    }
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
