// A v5 inbox popup. Reads the normalized cache from chrome.storage.local
// key "mailCache" only (shape from src/store/cache.js):
// { key, provider, account, from, subject, snippet, date, unread, localRead }
// where `key` is `provider + ':' + id`. Makes no network calls.
// Sign-in buttons and error states belong to Task 9, not this task.

import { threadUrl, searchUrl, gmailAccountOrder } from "./links.js";

(function () {
  "use strict";

  var CACHE_KEY = "mailCache";
  var ACCOUNTS_KEY = "accounts";

  var filter = "all";
  var items = [];
  var gmailAccounts = [];

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

  function persist(itemsToSave) {
    var store = storageLocal();
    if (!store) return;
    var payload = {};
    payload[CACHE_KEY] = itemsToSave;
    store.set(payload);
  }

  function markRead(key) {
    var changed = false;
    for (var i = 0; i < items.length; i++) {
      if (items[i].key === key && items[i].localRead !== true) {
        items[i].localRead = true;
        changed = true;
      }
    }
    if (changed) {
      persist(items);
      render();
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
    while (list.firstChild) list.removeChild(list.firstChild);
    var shown = visibleItems();
    empty.hidden = shown.length !== 0;

    shown.forEach(function (item) {
      var read = !isUnread(item);

      var card = document.createElement("li");
      card.className = "card" + (read ? " read" : "");
      // Keyboard path to the same local-only read flag the mouse click
      // sets: focus the card, press Enter or Space. Never opens provider.
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", "Mark as read: " + (item.subject || "(no subject)"));

      if (!read) {
        var dot = document.createElement("span");
        dot.className = "unread-dot";
        dot.setAttribute("aria-label", "Unread");
        card.appendChild(dot);
      }

      var top = document.createElement("div");
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
      card.appendChild(top);

      var main = document.createElement("div");
      main.className = "card-main";

      var avatar = document.createElement("span");
      avatar.className = "avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = avatarLetter(item.from);
      main.appendChild(avatar);

      var text = document.createElement("div");
      text.className = "card-text";

      var subject = document.createElement("p");
      subject.className = "card-subject";
      subject.textContent = item.subject || "(no subject)";
      text.appendChild(subject);

      var snippet = document.createElement("p");
      snippet.className = "card-snippet";
      snippet.textContent = item.snippet || "";
      text.appendChild(snippet);

      var open = document.createElement("button");
      open.type = "button";
      open.className = "card-open";
      open.textContent = "Open";
      open.setAttribute("aria-label", "Open in provider");
      open.addEventListener("click", function (event) {
        event.stopPropagation();
        markRead(item.key);
        openUrl(threadUrl(item, gmailAccounts));
      });
      text.appendChild(open);

      main.appendChild(text);
      card.appendChild(main);

      card.addEventListener("click", function () {
        markRead(item.key);
      });
      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          markRead(item.key);
        }
      });

      list.appendChild(card);
    });
  }

  function render() {
    renderHeader();
    renderPills();
    renderList();
  }

  function load() {
    var store = storageLocal();
    if (!store) {
      items = [];
      render();
      return;
    }
    // Account list drives Gmail authuser slots per card; absence keeps the
    // slot-less fallback in links.js. Storage reads only, no network.
    Promise.resolve(store.get([CACHE_KEY, ACCOUNTS_KEY])).then(function (data) {
      var cached = data ? data[CACHE_KEY] : null;
      items = Array.isArray(cached) ? cached : [];
      gmailAccounts = gmailAccountOrder(data ? data[ACCOUNTS_KEY] : null);
      render();
    });
  }

  function init() {
    var buttons = document.querySelectorAll(".pills button");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (event) {
        filter = event.currentTarget.getAttribute("data-filter") || "all";
        render();
      });
    }
    document.getElementById("provider-search").addEventListener("click", function () {
      openUrl(searchUrl(filter));
    });
    if (globalThis.chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === "local" && changes && (changes[CACHE_KEY] || changes[ACCOUNTS_KEY])) {
          if (changes[CACHE_KEY]) {
            var next = changes[CACHE_KEY].newValue;
            items = Array.isArray(next) ? next : [];
          }
          if (changes[ACCOUNTS_KEY]) {
            gmailAccounts = gmailAccountOrder(changes[ACCOUNTS_KEY].newValue);
          }
          render();
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
