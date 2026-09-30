import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
const tick = () => new Promise((r) => setTimeout(r, 0));
test("popup lifecycle controls send worker messages and preview preserves focus without writing cache", async () => {
  const { window, document } = parseHTML(
    readFileSync(new URL("../src/popup/popup.html", import.meta.url), "utf8"),
  );
  globalThis.document = document;
  globalThis.window = window;
  let focus = null;
  window.HTMLElement.prototype.focus = function () {
    focus = this;
  };
  Object.defineProperty(document, "activeElement", { get: () => focus });
  const cached = {
    key: "gmail:a%40gmail.com:1",
    provider: "gmail",
    account: "a@gmail.com",
    subject: "Full subject <script>literal</script>",
    snippet: "Full cached snippet",
    unread: true,
    date: Date.now(),
  };
  const data = {
    mailCache: [cached],
    accounts: [{ provider: "gmail", account: "a@gmail.com" }],
  };
  const messages = [];
  let storageListener;
  let writes = 0;
  globalThis.chrome = {
    runtime: {
      sendMessage: async (msg) => {
        messages.push(msg);
        return { ok: true };
      },
    },
    storage: {
      local: {
        get: async (key) => ({ [key]: data[key] }),
        set: async () => writes++,
      },
      onChanged: { addListener(listener) { storageListener = listener; } },
    },
  };
  await import(`../src/popup/popup.js?ui=${Date.now()}`);
  await tick();
  await tick();
  const card = document.querySelector(".card");
  const summary = card.querySelector("button.card-summary");
  assert.ok(summary, "preview uses a native button distinct from Open");
  assert.equal(card.hasAttribute("role"), false, "list item contains independent controls");
  assert.equal(summary.querySelector("button"), null);
  summary.focus();
  summary.click();
  await tick();
  assert.equal(document.activeElement, summary);
  assert.equal(summary.getAttribute("aria-expanded"), "true");
  assert.equal(summary.getAttribute("aria-controls"), card.querySelector(".card-preview").id);
  assert.equal(
    card.querySelector(".card-preview").textContent,
    cached.subject + cached.snippet,
  );
  assert.equal(writes, 0);
  assert.equal(messages.length, 0, "preview does not mark read");
  storageListener({ mailCache: { newValue: [cached] } }, "local");
  assert.equal(document.activeElement, document.querySelector(".card-summary"));
  assert.equal(document.activeElement.getAttribute("aria-expanded"), "true");
  const chime = document.querySelector("#sound-accounts input");
  chime.focus();
  storageListener({ soundSettings: { newValue: {
    masterMuted: false, volume: 0.7, mutedAccounts: { "gmail:a@gmail.com": true },
  } } }, "local");
  assert.equal(document.activeElement, document.querySelector("#sound-accounts input"));
  assert.equal(document.activeElement.checked, false);
  const volume = document.getElementById("sound-volume");
  volume.value = "25";
  volume.dispatchEvent(new window.Event("input"));
  assert.equal(document.getElementById("sound-volume-value").textContent, "25%");
  assert.equal(volume.getAttribute("aria-valuetext"), "25%");
  for (const id of ["add-gmail", "add-outlook", "refresh-mail"])
    assert.ok(document.getElementById(id), id);
  async function submitAddForm(email) {
    document.getElementById("add-account-email").value = email;
    document.getElementById("add-account-form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await tick();
    await tick();
  }
  document.getElementById("add-gmail").click();
  await tick();
  assert.equal(document.getElementById("add-account-form").hidden, false);
  assert.equal(document.getElementById("add-account-help-gmail").hidden, false);
  assert.equal(document.getElementById("add-account-help-outlook").hidden, true);
  await submitAddForm("second@gmail.com");
  assert.deepEqual(messages.at(-1), {
    type: "add-account",
    provider: "gmail",
    account: "second@gmail.com",
  });
  assert.equal(document.getElementById("add-account-form").hidden, true);
  assert.equal(document.activeElement, document.getElementById("add-gmail"));
  document.getElementById("add-outlook").click();
  await tick();
  assert.equal(document.getElementById("add-account-help-gmail").hidden, true);
  assert.equal(document.getElementById("add-account-help-outlook").hidden, false);
  await submitAddForm("second@outlook.com");
  assert.deepEqual(messages.at(-1), {
    type: "add-account",
    provider: "outlook",
    account: "second@outlook.com",
  });
  document.getElementById("refresh-mail").click();
  await tick();
  assert.equal(messages.at(-1).type, "refresh");
  const signout = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Sign out",
  );
  assert.ok(signout);
  signout.click();
  await tick();
  assert.equal(messages.at(-1).type, "sign-out");
  const remove = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Remove",
  );
  remove.click();
  await tick();
  assert.equal(messages.at(-1).type, "remove-account");
  let finishAction;
  let pendingRequests = 0;
  chrome.runtime.sendMessage = () => {
    pendingRequests++;
    return new Promise(resolve => { finishAction = resolve; });
  };
  const pending = document.querySelector('#account-controls [data-action="sign-out"]');
  pending.focus();
  pending.click();
  storageListener({ mailCache: { newValue: [cached] } }, "local");
  assert.equal(document.activeElement.dataset.action, "sign-out");
  assert.equal(document.activeElement.getAttribute("aria-disabled"), "true", "pending action stays focusable");
  document.activeElement.click();
  assert.equal(pendingRequests, 1, "pending action cannot be triggered twice");
  finishAction({ ok: true });
  await tick();
  assert.equal(document.activeElement.dataset.action, "sign-out");
  assert.equal(document.activeElement.getAttribute("aria-disabled"), "false");
  const recoveryState = { "gmail:a@gmail.com": { needsSignIn: true } };
  storageListener({ accountState: { newValue: recoveryState } }, "local");
  document.querySelector(".status-signin").focus();
  storageListener({ mailCache: { newValue: [cached] } }, "local");
  assert.ok(document.activeElement === document.querySelector(".status-signin"), "recovery focus survives refresh");
  const beforeRecovery = pendingRequests;
  document.activeElement.click();
  assert.equal(document.getElementById("settings-view").hidden, false);
  assert.equal(document.activeElement.dataset.action, "sign-in");
  assert.equal(pendingRequests, beforeRecovery, "Mail recovery navigates without starting auth");
  document.activeElement.click();
  storageListener({ mailCache: { newValue: [cached] } }, "local");
  assert.equal(document.activeElement.dataset.action, "sign-in");
  assert.equal(document.activeElement.getAttribute("aria-disabled"), "true");
  document.activeElement.click();
  assert.equal(pendingRequests, beforeRecovery + 1, "Settings sign-in cannot be repeated while pending");
  data.accountState = recoveryState;
  finishAction({ ok: true });
  await tick(); await tick();
  assert.equal(document.activeElement.dataset.action, "sign-in");
  assert.equal(document.activeElement.getAttribute("aria-disabled"), "false");
  storageListener({ accounts: { newValue: [] } }, "local");
  assert.equal(document.activeElement, document.getElementById("add-gmail"), "removed account has a surviving focus destination");
});
test("notification is silent so mute governs all extension sound", async () => {
  const { sendNotification } =
    await import("../src/background/service-worker.js");
  let options;
  globalThis.chrome = {
    notifications: {
      create: async (_id, value) => {
        options = value;
      },
    },
  };
  await sendNotification(
    { provider: "gmail", account: "a@gmail.com" },
    { title: "title", message: "text" },
  );
  assert.equal(options.silent, true);
});

let popupFixtureId = 0;
async function workspaceFixture(overrides = {}) {
  const { window, document } = parseHTML(
    readFileSync(new URL("../src/popup/popup.html", import.meta.url), "utf8"),
  );
  globalThis.document = document;
  globalThis.window = window;
  let focused;
  window.HTMLElement.prototype.focus = function () { focused = this; };
  Object.defineProperty(document, "activeElement", { get: () => focused });
  const data = {
    accounts: [{ provider: "gmail", account: "work@example.com" }],
    mailCache: [{ key: "gmail:work%40example.com:1", provider: "gmail",
      account: "work@example.com", subject: "Project review", unread: true,
      snippet: "A cached preview", date: Date.now() }],
    ...overrides,
  };
  const messages = [];
  const tabs = [];
  let listener;
  globalThis.chrome = {
    runtime: { sendMessage: async msg => { messages.push(msg); return { ok: true }; } },
    tabs: { create: async tab => { tabs.push(tab); } },
    storage: {
      local: {
        get: async key => ({ [key]: data[key] }),
        set: async value => Object.assign(data, value),
      },
      onChanged: { addListener: callback => { listener = callback; } },
    },
  };
  await import(`../src/popup/popup.js?workspace=${++popupFixtureId}`);
  await tick(); await tick();
  return { document, window, data, messages, tabs,
    change: changes => listener(changes, "local") };
}

test("workspace Settings isolates configuration and preserves Mail position and account drafts", async () => {
  const { document, change } = await workspaceFixture();
  const mail = document.getElementById("mail-view");
  const settings = document.getElementById("settings-view");
  assert.ok(mail && settings, "Mail and Settings have independent view shells");
  assert.equal(mail.hidden, false);
  assert.equal(settings.hidden, true);
  assert.equal(mail.querySelector("#add-gmail"), null);
  mail.scrollTop = 143;
  const opener = document.getElementById("open-settings");
  opener.focus(); opener.click();
  assert.equal(mail.hidden, true);
  assert.equal(settings.hidden, false);
  document.getElementById("add-gmail").click();
  const input = document.getElementById("add-account-email");
  input.value = "draft@example.com";
  change({ mailCache: { newValue: [] } });
  change({ accounts: { newValue: [{ provider: "gmail", account: "work@example.com" }] } });
  assert.equal(input.value, "draft@example.com");
  assert.equal(document.activeElement, input);
  document.getElementById("back-to-mail").click();
  assert.equal(settings.hidden, true);
  assert.equal(mail.hidden, false);
  assert.equal(mail.scrollTop, 143);
  assert.equal(document.activeElement, opener);
  opener.click();
  assert.equal(input.value, "draft@example.com");
  assert.equal(document.getElementById("add-account-form").hidden, false);
});

test("workspace groups same-provider accounts independently and keeps empty/status sections", async () => {
  const work = { provider: "gmail", account: "work@example.com" };
  const personal = { provider: "gmail", account: "personal@example.com" };
  const outlook = { provider: "outlook", account: "outlook@example.com" };
  const empty = { provider: "gmail", account: "empty@example.com", enabled: false };
  const mail = (acct, id, date) => ({ ...acct, key: `${acct.provider}:${encodeURIComponent(acct.account)}:${id}`,
    from: "Sender", subject: id, snippet: "Cached text", date, unread: true });
  const now = Date.now();
  const { document, messages, tabs, change } = await workspaceFixture({
    accounts: [work, personal, outlook, empty],
    mailCache: [mail(outlook, "outlook", now), mail(work, "old", now - 1000),
      mail(personal, "personal", now), mail(work, "new", now),
      mail({ provider: "gmail", account: "orphan@example.com" }, "orphan", now)],
    accountState: { "outlook:outlook@example.com": { needsSignIn: true } },
  });
  const sections = [...document.querySelectorAll(".account-section")];
  assert.deepEqual(sections.map(s => s.dataset.accountKey),
    ["gmail:work@example.com", "gmail:personal@example.com", "outlook:outlook@example.com", "gmail:empty@example.com"]);
  assert.deepEqual([...sections[0].querySelectorAll(".card-subject")].map(x => x.textContent), ["new", "old"]);
  assert.equal(sections[1].querySelectorAll(".card").length, 1);
  assert.equal(sections[2].querySelectorAll(".card").length, 1);
  assert.match(sections[3].textContent, /Paused/);
  assert.match(sections[3].textContent, /No messages/);
  assert.equal(document.querySelector('[data-key*="orphan"]'), null);
  const preview = sections[0].querySelector(".card-summary");
  preview.focus(); preview.click();
  assert.equal(messages.length, 0, "expanding only displays cached text");
  assert.equal(sections[0].querySelector(".account-count").textContent, "2 unread");
  preview.click();
  assert.equal(preview.getAttribute("aria-expanded"), "false");
  sections[0].querySelector(".card-open").click();
  await tick();
  assert.equal(messages.at(-1).type, "mark-read", "Open keeps existing local behavior");
  assert.match(tabs[0].url, /authuser=work%40example.com/);
  document.querySelector('[data-filter="outlook"]').click();
  assert.equal(document.querySelectorAll(".account-section").length, 1);
  const recovery = document.querySelector(".status-signin");
  const before = messages.length;
  recovery.click();
  assert.equal(document.getElementById("settings-view").hidden, false);
  assert.equal(document.activeElement.closest("li").dataset.accountKey, "outlook:outlook@example.com");
  assert.equal(document.activeElement.dataset.action, "sign-in");
  assert.equal(messages.length, before, "Mail recovery navigates; Settings starts sign-in explicitly");
  document.getElementById("back-to-mail").click();
  document.querySelector('[data-filter="all"]').click();
  const remaining = document.querySelector('.card-summary');
  remaining.focus();
  change({ mailCache: { newValue: [] } });
  assert.equal(document.activeElement, document.getElementById("refresh-mail"), "removed mail focus returns to Mail control");
});
