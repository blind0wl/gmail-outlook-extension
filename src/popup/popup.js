// A v5 inbox popup. Reads the normalized cache from chrome.storage.local
// key "mailCache" only (shape from src/store/cache.js):
// { key, provider, account, from, subject, snippet, date, unread, localRead }
// where `key` is `provider + ':' + id`. Makes no network calls.
// Sign-in buttons and error states belong to Task 9, not this task.

import { threadUrl, searchUrl, isCardSelfKeydown } from "./links.js";
import { getSoundSettings, setMuted, setVolume, SOUND_SETTINGS_KEY } from "../notify/sound.js";

(function () {
  "use strict";

  var CACHE_KEY = "mailCache";

  var filter = "all";
  var items = [];
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

  // Account for the Outlook-filter search view: newest cached Outlook
  // address, or "" for the slot-0 fallback in links.js.
  function newestOutlookAccount() {
    var best = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].provider === "outlook" && items[i].account) {
        if (!best || items[i].date > best.date) best = items[i];
      }
    }
    return best ? best.account : "";
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
        openUrl(threadUrl(item));
      });
      text.appendChild(open);

      main.appendChild(text);
      card.appendChild(main);

      card.addEventListener("click", function () {
        markRead(item.key);
      });
      // Card-level keys only: keydowns bubbling up from the nested Open
      // button are ignored so the button keeps native Enter/Space behavior.
      card.addEventListener("keydown", function (event) {
        if (!isCardSelfKeydown(event)) return;
        event.preventDefault();
        markRead(item.key);
      });

      list.appendChild(card);
    });
  }

  // Sound settings surface. Master mute plus per-account chime toggles
  // plus volume, all persisted under the same storage key the worker
  // reads, so both sides agree. Storage only, no network.
  function soundAccountKeys() {
    var seen = {};
    var keys = [];
    for (var i = 0; i < items.length; i++) {
      var key = items[i].provider + ":" + (items[i].account || "");
      if (!seen[key]) {
        seen[key] = true;
        keys.push({ key: key, label: (items[i].account || "") + " (" + items[i].provider + ")" });
      }
    }
    return keys;
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
    while (list.firstChild) list.removeChild(list.firstChild);
    soundAccountKeys().forEach(function (entry) {
      var li = document.createElement("li");
      var label = document.createElement("label");
      var box = document.createElement("input");
      box.type = "checkbox";
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
      label.appendChild(document.createTextNode(" Chime for " + entry.label));
      li.appendChild(label);
      list.appendChild(li);
    });
  }

  function loadSound() {
    Promise.resolve(getSoundSettings()).then(function (next) {
      sound = next;
      renderSound();
    });
  }

  function render() {
    renderHeader();
    renderPills();
    renderList();
    renderSound();
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
    var buttons = document.querySelectorAll(".pills button");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (event) {
        filter = event.currentTarget.getAttribute("data-filter") || "all";
        render();
      });
    }
    document.getElementById("provider-search").addEventListener("click", function () {
      openUrl(searchUrl(filter, newestOutlookAccount()));
    });
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
        }
      });
    }
    loadSound();
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
