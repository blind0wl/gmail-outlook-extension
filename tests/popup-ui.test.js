import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
// Linkedom exposes a getter-only select.value and does not model native selection.
function popupDOM(html) {
  const dom = parseHTML(html);
  for (const select of dom.document.querySelectorAll('select')) Object.defineProperty(select,'value',{
    get() { return this.querySelector('option[selected]')?.value ?? this.options[0]?.value; },
    set(value) { for(const option of this.options) { if(option.value===value) option.setAttribute('selected',''); else option.removeAttribute('selected'); } },
  });
  return dom;
}
const tick = () => new Promise((r) => setTimeout(r, 0));
test("popup lifecycle controls send worker messages and static previews never write cache", async () => {
  const { window, document } = popupDOM(
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
  assert.equal(card.querySelector(".card-summary"), null, "no preview toggle");
  assert.equal(card.querySelector(".card-preview"), null, "no expanded content");
  assert.equal(card.querySelector(".card-snippet").textContent, cached.snippet);
  assert.ok(card.querySelector(".card-toggle .card-subject"));
  assert.equal(card.querySelector("script"), null, "mail remains plain text");
  assert.equal(writes, 0);
  assert.equal(messages.length, 0, "displaying preview never marks read");
  const open = card.querySelector('[data-mail-action="open"]');
  assert.ok(open, "open is an icon action");
  open.focus();
  storageListener({ mailCache: { newValue: [cached] } }, "local");
  assert.equal(document.activeElement, document.querySelector('[data-mail-action="open"]'));
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
  const remove = document.querySelector('button[data-action="remove-account"]');
  remove.click();
  await tick();
  assert.equal(messages.at(-1).type, "remove-account");
  let finishAction;
  let pendingRequests = 0;
  test.afterEach(() => { try { finishAction?.({ ok: false, code: "teardown" }); } catch {} });
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
async function workspaceFixture(overrides = {}, configureChrome = () => {}) {
  const { window, document } = popupDOM(
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
  configureChrome(globalThis.chrome);
  await import(`../src/popup/popup.js?workspace=${++popupFixtureId}`);
  await tick(); await tick();
  return { document, window, data, messages, tabs,
    change: changes => {
      if (changes.mailActions) data.mailActions = changes.mailActions.newValue;
      listener(changes, "local");
    } };
}

test('header unread pill exposes accessible unread name', async () => {
  const { document } = await workspaceFixture();
  const el = document.getElementById('unread-count');
  assert.equal(el.getAttribute('aria-label'), '1 unread');
});

test('icon Remove exposes hover tooltip', async () => {
  const { document } = await workspaceFixture();
  const remove = document.querySelector('button[data-action="remove-account"]');
  assert.equal(remove.getAttribute('title'), 'Remove work@example.com');
  assert.equal(remove.getAttribute('aria-describedby'), 'account-remove-note');
});

test("Gmail read can be reversed locally before any provider write", async () => {
  const { document, messages } = await workspaceFixture();
  document.querySelector('[data-mail-action="read"]').click();
  assert.equal(document.querySelectorAll('.card.read').length, 1);
  assert.equal(document.querySelector('[data-mail-action="read"]').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('[data-mail-action="read"]').getAttribute('aria-disabled'), 'false');
  assert.equal(document.getElementById('unread-count').textContent, '');
  assert.equal(messages.length, 0);
  document.querySelector('[data-mail-action="read"]').click();
  assert.equal(document.querySelectorAll('.card.read').length, 0);
  assert.equal(document.getElementById('unread-count').textContent, '1');
  document.getElementById('unread-count').click();
  assert.equal(messages.length, 0, 'cancelled read never reaches the provider');
});

test("staged read commits after five seconds away from the card", async t => {
  const { document, messages } = await workspaceFixture();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  document.querySelector('[data-mail-action="read"]').click();
  t.mock.timers.tick(4999);
  assert.equal(document.querySelectorAll('.card.read').length, 1);
  assert.equal(messages.length, 0);
  t.mock.timers.tick(1);
  assert.equal(document.querySelectorAll('.card').length, 0);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].action, 'read');
  await new Promise(setImmediate);
  assert.equal(document.getElementById('lifecycle-message').textContent, '');
});

for (const interaction of ['hover', 'focus']) test(`staged read waits while ${interaction} remains on the card`, async t => {
  const { document, window, messages, change, data } = await workspaceFixture();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const card = document.querySelector('.card');
  if (interaction === 'hover') card.dispatchEvent(new window.Event('mouseenter'));
  else card.querySelector('[data-mail-action="read"]').focus();
  card.querySelector('[data-mail-action="read"]').click();
  change({ mailCache: { newValue: data.mailCache } });
  t.mock.timers.tick(10000);
  assert.equal(messages.length, 0);
  assert.equal(document.querySelectorAll('.card.read').length, 1);
  const current = document.querySelector('.card');
  if (interaction === 'hover') current.dispatchEvent(new window.Event('mouseleave'));
  else {
    document.getElementById('refresh-mail').focus();
    current.dispatchEvent(new window.Event('focusout', { bubbles: true }));
  }
  await new Promise(setImmediate);
  t.mock.timers.tick(4999);
  assert.equal(messages.length, 0);
  t.mock.timers.tick(1);
  assert.equal(messages.length, 1);
  await new Promise(setImmediate);
});

test("mouse focus does not prevent the five-second grace period after leaving", async t => {
  const { document, window, messages } = await workspaceFixture();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const card = document.querySelector('.card');
  card.dispatchEvent(new window.Event('mouseenter'));
  const read = card.querySelector('[data-mail-action="read"]');
  read.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  read.focus();
  read.click();
  document.querySelector('.card').dispatchEvent(new window.Event('mouseleave'));
  t.mock.timers.tick(5000);
  assert.equal(messages.length, 1);
  await new Promise(setImmediate);
});

test("clicking outside commits staged reads immediately and silently", async () => {
  const { document, messages } = await workspaceFixture();
  document.querySelector('[data-mail-action="read"]').focus();
  document.querySelector('[data-mail-action="read"]').click();
  assert.equal(messages.length, 0);
  document.getElementById('unread-count').click();
  assert.equal(messages.length, 1);
  assert.equal(document.querySelectorAll('.card').length, 0);
  await tick();
  assert.equal(document.getElementById('lifecycle-message').textContent, '');
});

test("popup dismissal commits staged reads once", async () => {
  const { document, window, messages } = await workspaceFixture();
  document.querySelector('[data-mail-action="read"]').click();
  window.dispatchEvent(new window.Event('pagehide'));
  window.dispatchEvent(new window.Event('pagehide'));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].action, 'read');
  await tick();
});

test("clicking a locked action on another card commits the staged read", async () => {
  const { document, data, messages, change } = await workspaceFixture();
  const original = data.mailCache[0];
  const locked = { ...original, key: 'gmail:work%40example.com:locked' };
  change({ mailCache: { newValue: [original, locked] }, mailActions: { newValue: {
    [locked.key]: { state: 'uncertain', item: locked },
  } } });
  document.querySelector(`[data-key="${original.key}"] [data-mail-action="read"]`).click();
  document.querySelector(`[data-key="${locked.key}"] [data-mail-action="trash"]`).click();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].key, original.key);
  assert.equal(messages[0].action, 'read');
  await tick();
});

for (const disabled of [false, true]) test(`account ${disabled ? "disable" : "removal"} cancels its staged read`, async t => {
  const { document, window, data, change, messages } = await workspaceFixture();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  document.querySelector('[data-mail-action="read"]').click();
  change({ accounts: { newValue: disabled ? [{ ...data.accounts[0], enabled: false }] : [] } });
  t.mock.timers.tick(5000);
  window.dispatchEvent(new window.Event('pagehide'));
  assert.equal(messages.length, 0);
  assert.equal(document.querySelectorAll('.card.read').length, 0);
});

test("moving outside after card replacement releases the hover grace period", async t => {
  const { document, window, messages, data, change } = await workspaceFixture();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  document.querySelector('.card').dispatchEvent(new window.Event('mouseenter'));
  document.querySelector('[data-mail-action="read"]').click();
  change({ mailCache: { newValue: data.mailCache } });
  document.getElementById('unread-count').dispatchEvent(new window.Event('pointermove', { bubbles: true }));
  t.mock.timers.tick(5000);
  assert.equal(messages.length, 1);
  await new Promise(setImmediate);
});

test("Open on a staged read performs only the extension-local Open", async t => {
  const { document, window, messages, tabs } = await workspaceFixture();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  document.querySelector('.card-toggle').click();
  document.querySelector('[data-mail-action="open"]').click();
  window.dispatchEvent(new window.Event('blur'));
  t.mock.timers.tick(5000);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'mark-read');
  assert.equal(tabs.length, 1);
  assert.equal(document.getElementById('unread-count').textContent, '');
  assert.equal(document.querySelector('.account-count').getAttribute('aria-label'), '0 unread');
  assert.equal(document.getElementById('unread-count').getAttribute('aria-label'), '0 unread');
  await new Promise(setImmediate);
});

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
  assert.ok(sections[0].querySelector(".card-snippet"));
  assert.equal(messages.length, 0, "preview is visible without interaction");
  assert.equal(sections[0].querySelector(".account-count").getAttribute("aria-label"), "2 unread");
  sections[0].querySelector('[data-mail-action="open"]').click();
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
  const remaining = document.querySelector('[data-mail-action="open"]');
  remaining.focus();
  change({ mailCache: { newValue: [] } });
  assert.equal(document.activeElement, document.getElementById("refresh-mail"), "removed mail focus returns to Mail control");
});

test("workspace themes persist without replacing focused controls or draft form input", async () => {
  const { document, window, data, change } = await workspaceFixture({ popupTheme: "slate" });
  const assertSelectedThemeMirrorsRadios = expected => {
    for (const choice of document.querySelectorAll(".theme-choice")) {
      const radio = choice.querySelector('input[name="popup-theme"]');
      assert.equal(radio.checked, radio.value === expected, `${radio.value} radio selection`);
      assert.equal(choice.getAttribute("data-selected"), String(radio.checked), `${radio.value} selected styling state`);
    }
  };
  assert.equal(document.documentElement.dataset.theme, "slate");
  assertSelectedThemeMirrorsRadios("slate");
  document.getElementById("open-settings").click();
  document.getElementById("add-gmail").click();
  const draft = document.getElementById("add-account-email");
  draft.value = "unfinished@example.com";
  const signal = document.querySelector('input[name="popup-theme"][value="signal"]');
  signal.focus(); signal.checked = true;
  signal.dispatchEvent(new window.Event("change", { bubbles: true }));
  await tick();
  assert.equal(document.documentElement.dataset.theme, "signal");
  assertSelectedThemeMirrorsRadios("signal");
  assert.equal(document.activeElement, signal);
  assert.equal(draft.value, "unfinished@example.com");
  assert.equal(data.popupTheme, "signal");
  change({ popupTheme: { newValue: "slate" } });
  assert.equal(document.documentElement.dataset.theme, "slate");
  assertSelectedThemeMirrorsRadios("slate");
  assert.equal(document.activeElement, signal, "external preference update preserves focus");
  const next = await workspaceFixture({ popupTheme: data.popupTheme });
  assert.equal(next.document.documentElement.dataset.theme, "signal", "reopen loads saved choice");
  for (const choice of next.document.querySelectorAll(".theme-choice")) {
    const radio = choice.querySelector('input[name="popup-theme"]');
    assert.equal(choice.getAttribute("data-selected"), String(radio.checked), `${radio.value} selected styling state after reopen`);
  }
});

test("workspace failed theme save reports recovery while retaining usable selected appearance", async () => {
  const { document, window } = await workspaceFixture();
  document.getElementById("open-settings").click();
  chrome.storage.local.set = async () => { throw new Error("private storage details"); };
  const slate = document.querySelector('input[name="popup-theme"][value="slate"]');
  assert.ok(slate, "Settings includes native theme choices");
  slate.checked = true;
  slate.dispatchEvent(new window.Event("change", { bubbles: true }));
  await tick(); await tick();
  assert.equal(document.documentElement.dataset.theme, "slate");
  assert.match(document.getElementById("theme-message").textContent, /could not be saved/i);
  assert.equal(document.body.textContent.includes("private storage details"), false);
  document.getElementById("back-to-mail").click();
  assert.equal(document.getElementById("mail-view").hidden, false);
});

test("Mail refresh failures are announced outside the hidden Settings view", async () => {
  const { document } = await workspaceFixture();
  chrome.runtime.sendMessage = async () => { throw new Error("private provider detail"); };
  document.getElementById("refresh-mail").click();
  await tick();
  const status = document.getElementById("lifecycle-message");
  assert.ok(!status.closest("#settings-view"), "Mail must expose refresh failure feedback");
  assert.match(status.textContent, /refresh/i);
  assert.equal(status.textContent.includes("private provider detail"), false);
});

for (const outcome of [{ ok: true }, { ok: false, code: "SIGNED_OUT" }]) test(`a completed account add (${outcome.ok ? "success" : "failure"}) cannot close a newer form or erase its draft`, async () => {
  const { document, window } = await workspaceFixture();
  let finish;
  chrome.runtime.sendMessage = async () => new Promise(resolve => { finish = resolve; });
  document.getElementById("open-settings").click();
  document.getElementById("add-gmail").click();
  const email = document.getElementById("add-account-email");
  email.value = "first@example.com";
  document.getElementById("add-account-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await tick();
  document.getElementById("add-account-cancel").click();
  document.getElementById("add-outlook").click();
  email.value = "new-draft@example.com";
  finish(outcome);
  await tick();
  assert.equal(email.value, "new-draft@example.com");
  assert.equal(document.getElementById("add-account-form").hidden, false);
  assert.ok(document.activeElement === email);
  assert.match(document.getElementById("add-account-title").textContent, /Outlook/);
  assert.equal(document.getElementById("add-account-error").hidden, true);
});

test("opened mail leaves the list and follows saved local state", async () => {
  const now = Date.now();
  const mail = (id, extra = {}) => ({ key: `gmail:work%40example.com:${id}`, provider: "gmail",
    account: "work@example.com", from: "Sender", subject: id, snippet: "text",
    date: now, unread: true, ...extra });
  const { document, change, messages, tabs } = await workspaceFixture({
    mailCache: [mail("one"), mail("two")],
  });
  assert.equal(document.querySelector(".account-count").getAttribute("aria-label"), "2 unread");
  document.querySelector('[data-mail-action="open"]').click();
  await tick();
  assert.equal(document.querySelectorAll(".card").length, 1, "opened card leaves instantly");
  assert.equal(messages.at(-1).type, "mark-read");
  assert.match(tabs[0].url, /authuser=work%40example.com/);
  change({ mailCache: { newValue: [mail("one", { localRead: true }), mail("two")] } });
  assert.equal(document.querySelectorAll(".card").length, 1, "stays gone while opened locally");
  change({ mailCache: { newValue: [mail("one"), mail("two")] } });
  assert.equal(document.querySelectorAll(".card").length, 2, "clearing saved local state returns the unread card");
});

test("expanding unread mail stages read and keeps the card expanded until dismissal", async () => {
  const { document, data, messages, tabs } = await workspaceFixture();
  const card = document.querySelector(".card");
  const toggle = card.querySelector(".card-toggle");
  assert.ok(toggle, "card content is a toggle control");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(card.classList.contains("expanded"), false);
  const icons = card.querySelector(".card-icons");
  assert.ok(icons, "open/read/delete icon actions are available");
  assert.equal(icons.querySelector('[data-mail-action="read"]')?.getAttribute("aria-label")?.includes("conversation as read"), true);
  toggle.click();
  let current = document.querySelector(".card");
  assert.equal(current.classList.contains("expanded"), true);
  assert.equal(current.classList.contains("read"), true, "expansion projects read styling immediately");
  assert.equal(data.mailCache[0].unread, true, "expansion keeps the cached provider snapshot unchanged");
  assert.equal(current.querySelector(".card-toggle").getAttribute("aria-expanded"), "true");
  assert.equal(document.getElementById("unread-count").textContent, "", "expansion updates the unread count immediately");
  assert.equal(messages.length, 0, "the provider write waits for dismissal");
  assert.equal(tabs.length, 0, "expansion never opens a provider tab");
  current.querySelector(".card-sender").click();
  current = document.querySelector(".card");
  assert.equal(current.classList.contains("expanded"), false, "clicking the card again collapses");
  assert.equal(current.classList.contains("read"), true, "collapsing does not cancel the staged read");
  current.querySelector(".card-toggle").click();
  current = document.querySelector(".card");
  assert.equal(current.classList.contains("expanded"), true, "re-expansion stays available");
  assert.equal(messages.length, 0, "re-expansion does not cancel or commit the staged read");
  document.getElementById("unread-count").click();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].action, "read");
});

test("expanding another card commits the first staged read, then stages the second", async () => {
  const now = Date.now();
  const mail = (id) => ({ key: "gmail:work%40example.com:" + id, provider: "gmail",
    account: "work@example.com", from: "Sender", subject: id, snippet: "text",
    date: now, unread: true });
  const { document, messages } = await workspaceFixture({ mailCache: [mail("one"), mail("two")] });
  document.querySelector('[data-key$=":one"] .card-toggle').click();
  assert.equal(document.querySelector('[data-key$=":one"]')?.classList.contains("read"), true);
  document.querySelector('[data-key$=":two"] .card-toggle').click();
  assert.equal(messages.length, 1, "the previous staged read commits on another-card click");
  assert.equal(messages[0].key, "gmail:work%40example.com:one");
  const second = document.querySelector('[data-key$=":two"]');
  assert.ok(second, "the newly expanded card remains present");
  assert.equal(second.classList.contains("expanded"), true);
  assert.equal(second.classList.contains("read"), true);
  assert.equal(second.querySelector(".card-toggle").getAttribute("aria-expanded"), "true");
  assert.equal(document.querySelectorAll(".card.expanded").length, 1, "the accordion keeps one expanded card");
  document.getElementById("unread-count").click();
  assert.equal(messages.length, 2, "the second staged read commits when leaving it");
  assert.equal(messages[1].key, "gmail:work%40example.com:two");
});

test("mail action keys remain available to native buttons without expanding the preview", async () => {
  const { document, window, messages } = await workspaceFixture();
  const card = document.querySelector('.card');
  for (const action of ['open', 'read', 'trash']) {
    for (const key of ['Enter', ' ']) {
      const event = new window.Event('keydown', { bubbles: true, cancelable: true });
      event.key = key;
      card.querySelector(`[data-mail-action="${action}"]`).dispatchEvent(event);
      assert.equal(event.defaultPrevented, false, `${action} must retain native ${key} activation`);
      assert.equal(card.classList.contains('expanded'), false, 'action keys never expand cached text');
    }
  }
  assert.equal(messages.length, 0, 'keydown alone does not write mail');
  const expand = new window.Event('keydown', { bubbles: true, cancelable: true });
  expand.key = 'Enter';
  card.querySelector('.card-toggle').dispatchEvent(expand);
  assert.equal(expand.defaultPrevented, true, 'preview handles its own key');
  const current = document.querySelector('.card');
  assert.equal(current.classList.contains('expanded'), true);
  assert.equal(current.classList.contains('read'), true, 'Enter stages read just like a mouse click');
  assert.equal(document.getElementById('unread-count').textContent, '');
  const collapse = new window.Event('keydown', { bubbles: true, cancelable: true });
  collapse.key = ' ';
  current.querySelector('.card-toggle').dispatchEvent(collapse);
  assert.equal(collapse.defaultPrevented, true, 'Space is handled by the preview');
  assert.equal(document.querySelector('.card').classList.contains('expanded'), false);
  const reexpand = new window.Event('keydown', { bubbles: true, cancelable: true });
  reexpand.key = ' ';
  document.querySelector('.card-toggle').dispatchEvent(reexpand);
  assert.equal(document.querySelector('.card').classList.contains('expanded'), true);
  assert.equal(messages.length, 0, 'Space re-expansion preserves the original staged read');
  document.getElementById('unread-count').click();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].action, 'read');
});

test("Mark unread cancels expansion read without collapsing the card", async () => {
  const { document, messages } = await workspaceFixture();
  document.querySelector(".card-toggle").click();
  assert.equal(document.querySelector(".card").classList.contains("expanded"), true);
  const read = document.querySelector('[data-mail-action="read"]');
  assert.equal(read.getAttribute("aria-disabled"), "false", "Gmail Mark unread remains available during the grace period");
  read.click();
  const current = document.querySelector(".card");
  assert.equal(current.classList.contains("expanded"), true, "icon activation does not collapse the preview");
  assert.equal(current.classList.contains("read"), false, "Mark unread restores unread styling");
  assert.equal(document.getElementById('unread-count').textContent, '1');
  assert.equal(messages.length, 0, "cancellation never reaches the provider");
});

test("expanded unread card commits read after five seconds away", async t => {
  const { document, messages } = await workspaceFixture();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  document.querySelector(".card-toggle").click();
  t.mock.timers.tick(4999);
  assert.equal(messages.length, 0);
  assert.equal(document.querySelectorAll(".card.read").length, 1);
  t.mock.timers.tick(1);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].action, "read");
  assert.equal(document.querySelectorAll(".card").length, 0);
});

test("expanded card hover pauses read dismissal across a synchronous rerender", async t => {
  const { document, window, messages, data, change } = await workspaceFixture();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  document.querySelector(".card").dispatchEvent(new window.Event("mouseenter"));
  document.querySelector(".card-toggle").click();
  change({ mailCache: { newValue: data.mailCache } });
  t.mock.timers.tick(10000);
  assert.equal(messages.length, 0, "hover remains active after the card node is replaced");
  const current = document.querySelector(".card");
  assert.ok(current.querySelector('[data-mail-action="trash"]'), "Trash stays available on the expanded card");
  document.getElementById("unread-count").dispatchEvent(new window.Event("pointermove", { bubbles: true }));
  t.mock.timers.tick(4999);
  assert.equal(messages.length, 0);
  t.mock.timers.tick(1);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].action, "read");
});

test("expanded card keyboard focus pauses read dismissal and Space expands it", async t => {
  const { document, window, messages, data, change } = await workspaceFixture();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  document.querySelector(".card-toggle").focus();
  const expand = new window.Event("keydown", { bubbles: true, cancelable: true });
  expand.key = " ";
  document.querySelector(".card-toggle").dispatchEvent(expand);
  assert.equal(expand.defaultPrevented, true);
  change({ mailCache: { newValue: data.mailCache } });
  t.mock.timers.tick(10000);
  assert.equal(messages.length, 0, "keyboard focus pauses dismissal after focus restoration");
  const current = document.querySelector(".card");
  document.getElementById("refresh-mail").focus();
  current.dispatchEvent(new window.Event("focusout", { bubbles: true }));
  await new Promise(setImmediate);
  t.mock.timers.tick(4999);
  assert.equal(messages.length, 0);
  t.mock.timers.tick(1);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].action, "read");
});

test("a click still bubbles with its original card after expansion rerenders the list", async () => {
  const { document, messages } = await workspaceFixture();
  const key = "gmail:work%40example.com:1";
  let bubbledKey = null;
  document.addEventListener("click", event => {
    const card = event.target?.closest?.(".card");
    if (card) bubbledKey = card.dataset.key;
  }, { once: true });
  document.querySelector(".card-toggle").click();
  assert.equal(bubbledKey, key, "document sees the event path captured before synchronous replacement");
  assert.equal(document.querySelector(".card").classList.contains("read"), true);
  assert.equal(messages.length, 0, "the originating card is not mistaken for an outside click");
  document.querySelector('[data-mail-action="read"]').click();
  assert.equal(messages.length, 0, "Mark unread cancels the staged interaction and its timer");
});

for (const state of ["pending", "uncertain"]) test(`expansion does not stage a locked action (${state})`, async t => {
  const { document, data, change, messages } = await workspaceFixture();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const item = data.mailCache[0];
  change({ mailActions: { newValue: { [item.key]: { state, item } } } });
  document.querySelector(".card-toggle").click();
  assert.equal(document.querySelector(".card").classList.contains("expanded"), true, "cached content can still expand");
  assert.equal(document.querySelector(".card").classList.contains("read"), false, "locked mail stays unread");
  assert.equal(document.getElementById("unread-count").textContent, "1");
  assert.equal(document.querySelector('[data-mail-action="read"]').getAttribute("aria-disabled"), "true");
  t.mock.timers.tick(10000);
  assert.equal(messages.length, 0, "no read write was staged");
});

test("Trash stays available on an expanded staged card and cancels its read", async () => {
  const { document, messages } = await workspaceFixture();
  document.querySelector(".card-toggle").click();
  const trash = document.querySelector('[data-mail-action="trash"]');
  assert.ok(trash, "Trash remains available while expanded");
  assert.equal(trash.getAttribute("aria-disabled"), "false");
  trash.click();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "mail-action");
  assert.equal(messages[0].action, "trash");
});

test("outlook read commits on outside click and stays silent", async () => {
  const outlook = { provider: "outlook", account: "o@example.test" };
  const { document, messages } = await workspaceFixture({
    accounts: [outlook],
    mailCache: [{ ...outlook, key: "outlook:o%40example.test:1", from: "Sender", subject: "Hello", snippet: "text", date: Date.now(), unread: true }],
  });
  chrome.runtime.sendMessage = async (msg) => { messages.push(msg); return { ok: true }; };
  document.querySelector('[data-mail-action="read"]').click();
  document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  await tick();
  await tick();
  assert.equal(document.querySelectorAll(".card").length, 0, "committed Outlook read leaves");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].action, "read");
  assert.equal(document.getElementById("lifecycle-message").textContent, "", "reads stay silent");
});

test("gmail read commits on outside click and the write runs in the background", async () => {
  const { document, messages } = await workspaceFixture();
  chrome.runtime.sendMessage = async (msg) => { messages.push(msg); return { ok: true }; };
  document.querySelector('[data-mail-action="read"]').click();
  document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  await tick();
  await tick();
  assert.equal(document.querySelectorAll(".card").length, 0, "committed read card leaves");
  assert.equal(document.getElementById("lifecycle-message").textContent, "", "no progress or success chatter");
  assert.equal(messages.length, 1, "provider write sent in background");
  assert.equal(messages[0].action, "read");
});

test("failed gmail read repopulates the card with the error only", async () => {
  const { document } = await workspaceFixture();
  let finish;
  chrome.runtime.sendMessage = () => new Promise((r) => { finish = r; });
  test.afterEach(() => { try { finish?.({ ok: false, code: "teardown" }); } catch {} });
  document.querySelector('[data-mail-action="read"]').click();
  document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  assert.equal(document.querySelectorAll(".card").length, 0, "card leaves instantly");
  finish({ ok: false, code: "provider-error" });
  await tick();
  assert.ok(document.querySelector(".card"), "card repopulates after failure");
  assert.match(document.getElementById("lifecycle-message").textContent, /unavailable|rejected/i);
});

test("opened mail leaves instantly and stays gone across saved local-state updates", async () => {
  const now = Date.now();
  const mail = (id, extra = {}) => ({ key: `gmail:work%40example.com:${id}`, provider: "gmail",
    account: "work@example.com", from: "Sender", subject: id, snippet: "text",
    date: now, unread: true, ...extra });
  const { document, change, messages } = await workspaceFixture({
    mailCache: [mail("one"), mail("two")],
  });
  document.querySelector('[data-mail-action="open"]').click();
  await tick();
  assert.equal(document.querySelectorAll(".card").length, 1, "opened card leaves instantly");
  assert.equal(document.getElementById("lifecycle-message").textContent, "", "no chatter");
  change({ mailCache: { newValue: [mail("one", { localRead: true }), mail("two")] } });
  assert.equal(document.querySelectorAll(".card").length, 1, "stays gone across provider refresh");
  assert.equal(messages.at(-1).type, "mark-read");
});

test("pending opened-here dismissal survives an older cache snapshot", async () => {
  const { document, data, change } = await workspaceFixture();
  const cached = { ...data.mailCache[0] };
  let finish;
  chrome.runtime.sendMessage = () => new Promise(resolve => { finish = resolve; });
  document.querySelector('[data-mail-action="open"]').click();
  change({ mailCache: { newValue: [cached] } });
  assert.equal(document.querySelectorAll('.card').length, 0);
  finish({ ok: true });
  await tick(); await tick();
  assert.equal(document.querySelectorAll('.card').length, 0);
  assert.equal(document.getElementById('lifecycle-message').textContent, '');
});

for (const removed of [false, true]) test(`failed read restores the card after cache ${removed ? "removal" : "read commit"}`, async () => {
  const { document, data, change } = await workspaceFixture();
  const cached = { ...data.mailCache[0] };
  let finish;
  chrome.runtime.sendMessage = () => new Promise(resolve => { finish = resolve; });
  document.querySelector('[data-mail-action="read"]').click();
  document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  change({ mailCache: { newValue: removed ? [] : [{ ...cached, unread: false }] } });
  finish({ ok: false, code: 'check-mailbox' });
  await tick(); await tick();
  assert.equal(document.querySelectorAll('.card').length, 1);
  assert.match(document.querySelector('.card-error').textContent, /could not be confirmed/i);
  assert.equal(document.querySelector('[data-mail-action="read"]').getAttribute('aria-disabled'), 'false');
  document.querySelector('[data-mail-action="open"]').click();
  finish({ ok: false });
  await tick(); await tick();
  assert.equal(document.querySelectorAll('.card').length, 1, 'failed Open retains the recovery card');
});

for (const rejects of [false, true]) test(`failed opened-here persistence restores the card (${rejects ? "transport" : "worker"} failure)`, async () => {
  const { document, messages } = await workspaceFixture();
  chrome.runtime.sendMessage = async msg => {
    messages.push(msg);
    if (rejects) throw new Error("private storage detail");
    return { ok: false };
  };
  document.querySelector('[data-mail-action="open"]').click();
  assert.equal(document.querySelectorAll('.card').length, 0);
  await tick(); await tick();
  assert.equal(document.querySelectorAll('.card').length, 1);
  assert.match(document.getElementById('lifecycle-message').textContent, /could not.*opened/i);
  assert.doesNotMatch(document.body.textContent, /private storage detail/);
  assert.equal(messages[0].type, 'mark-read');
});

test("successful opened-here persistence does not erase another action's error", async () => {
  const { document } = await workspaceFixture();
  chrome.runtime.sendMessage = async () => ({ ok: false, code: 'provider-error' });
  document.querySelector('[data-mail-action="read"]').click();
  document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  await tick(); await tick();
  const error = document.getElementById('lifecycle-message').textContent;
  assert.ok(error);
  chrome.runtime.sendMessage = async () => ({ ok: true });
  document.querySelector('[data-mail-action="open"]').click();
  await tick(); await tick();
  assert.equal(document.getElementById('lifecycle-message').textContent, error);
});

test("settings leads with accounts before themes", async () => {
  const { document } = await workspaceFixture();
  const labels = [...document.querySelectorAll("#settings-view > section")]
    .map((s) => s.getAttribute("aria-label") || s.querySelector("h2")?.textContent);
  assert.ok(labels.includes("Accounts") && labels.includes("Themes"));
  assert.ok(labels.indexOf("Accounts") < labels.indexOf("Themes"));
});

test("healthy accounts show a visible checked stamp; failed accounts do not", async () => {
  const stamped = await workspaceFixture({
    accountState: { "gmail:work@example.com": { checkedAt: Date.now() } },
  });
  assert.match(stamped.document.querySelector(".account-checked")?.textContent ?? "", /Checked /);
  const failed = await workspaceFixture({
    accountState: { "gmail:work@example.com": { backedOff: true, retryAt: Date.now() + 60_000, status: 429 } },
  });
  assert.equal(failed.document.querySelector(".account-checked"), null);
  assert.match(failed.document.querySelector(".account-note")?.textContent ?? "", /retries automatically/);
});

test("successful refresh reports a checked state, not an error", async () => {
  const { document } = await workspaceFixture();
  document.getElementById("refresh-mail").click();
  await tick(); await tick();
  const status = document.getElementById("lifecycle-message");
  assert.match(status.textContent, /Checked mail/);
  assert.equal(status.dataset.state, "ok");
});

test("cancelled outlook add names the cancelled step instead of blaming the address", async () => {
  const { document, window } = await workspaceFixture();
  chrome.runtime.sendMessage = async () => ({ ok: false, code: "flow-cancelled" });
  document.getElementById("open-settings").click();
  document.getElementById("add-outlook").click();
  document.getElementById("add-account-email").value = "someone@outlook.com";
  document.getElementById("add-account-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await tick(); await tick();
  const err = document.getElementById("add-account-error");
  assert.equal(err.hidden, false);
  assert.match(err.textContent, /cancelled/);
});

test('Gmail Trash is available and sends the scoped action',async()=>{
  const {document,messages}=await workspaceFixture();
  const trash=document.querySelector('[data-mail-action="trash"]');
  assert.equal(trash.getAttribute('aria-disabled'),'false');
  assert.match(trash.title,/conversation to Trash/);
  assert.doesNotMatch(document.body.textContent,/Gmail Trash is temporarily unavailable/);
  trash.click();await tick();
  assert.equal(messages.length,1);
  assert.equal(messages[0].action,'trash');
  assert.equal(messages[0].type,'mail-action');
});

test('hover actions use provider-specific labels and resist duplicate clicks', async () => {
  const { document, messages, change } = await workspaceFixture();
  const read = document.querySelector('[data-mail-action="read"]');
  assert.match(read.getAttribute('aria-label'),/conversation as read/);
  assert.match(document.querySelector('[data-mail-action="trash"]').getAttribute('aria-label'),/conversation to Trash/);
  let finish;
  chrome.runtime.sendMessage=async msg=>{messages.push(msg);await new Promise(r=>finish=r);return {ok:true};};
  read.focus();read.click();
  document.getElementById('unread-count').click();
  read.click();
  await tick();
  assert.equal(document.querySelectorAll('.card').length,0,'committed read hides while the write runs');
  assert.equal(messages.length,1);
  assert.equal(messages[0].type,'mail-action');assert.equal(messages[0].action,'read');
  test.afterEach(() => { try { finish?.(); } catch {} });
  finish();await tick();
  change({mailActions:{newValue:{one:{state:'undo',expiresAt:Date.now()+60000,item:{provider:'gmail',account:'work@example.com',subject:'Test'}}}}});
  assert.ok(!document.querySelector('[data-undo-key]'));
});

test('mailbox feedback is immediate while worker is pending and rolls back a failed action',async()=>{
  const {document,change}=await workspaceFixture();
  const key=document.querySelector('.card').dataset.key;
  let finish;
  chrome.runtime.sendMessage=()=>new Promise(r=>finish=r);
  document.querySelector('[data-mail-action="read"]').click();
  document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  assert.equal(document.querySelectorAll('.card').length,0,'committed read card leaves, no pending style shown');
  change({mailCache:{newValue:[{key,provider:'gmail',account:'work@example.com',subject:'new cache text',snippet:'text',date:Date.now(),unread:true}]}});
  assert.equal(document.querySelectorAll('.card').length,0,'stale cache cannot restore the card while the write runs');
  finish({ok:false,code:'provider-error'});await tick();
  assert.ok(document.querySelector('.card'),'failure repopulates the card');
  assert.equal(document.querySelector('.card').classList.contains('read'),false,'failure restores unread card');
  const outlook={provider:'outlook',account:'outlook@example.test'};
  change({accounts:{newValue:[outlook]},mailCache:{newValue:[{key:'outlook:outlook%40example.test:1',...outlook,date:Date.now(),unread:true}]}});
  document.querySelector('[data-mail-action="trash"]').click();
  assert.equal(document.querySelectorAll('.card').length,0,'Trash hides card before worker response');
  finish({ok:false,code:'provider-error'});await tick();
  assert.ok(document.querySelector('.card'),'failed Trash restores card');
});

test('provider-read cards are filtered out',async()=>{
  const {document,change}=await workspaceFixture();
  const key=document.querySelector('.card').dataset.key;
  change({mailCache:{newValue:[{key,provider:'gmail',account:'work@example.com',date:Date.now(),unread:false}]}});
  assert.equal(document.querySelectorAll('.card').length,0,'server-read mail is no longer needed in popup');
});


test('confirmed read feedback resists stale unread cache until reconciliation, then allows new unread mail',async()=>{
  const {document,change,data}=await workspaceFixture();
  const cached=data.mailCache[0];
  let finish;
  chrome.runtime.sendMessage=()=>new Promise(r=>finish=r);
  document.querySelector('[data-mail-action="read"]').click();
  document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  finish({ok:true});await tick();
  assert.equal(document.querySelectorAll('.card').length,0);
  change({mailCache:{newValue:[cached]}});
  assert.equal(document.querySelectorAll('.card').length,0,'stale unread snapshot cannot undo confirmed feedback');
  change({mailCache:{newValue:[{...cached,unread:false}]}});
  change({mailCache:{newValue:[{...cached,date:Date.now()+1000}]}});
  assert.ok(document.querySelector('.card'),'a later unread reply in the same conversation can appear');
});

test('read cache arriving before action response keeps the card hidden until failure or new unread mail',async()=>{
  const outlook={provider:'outlook',account:'o@example.test'};
  const {document,change}=await workspaceFixture({
    accounts:[outlook],
    mailCache:[{...outlook,key:'outlook:o%40example.test:1',from:'Sender',subject:'Session',snippet:'text',date:Date.now(),unread:true}],
  });
  const cached={...outlook,key:'outlook:o%40example.test:1',from:'Sender',subject:'Session',snippet:'text',date:Date.now(),unread:true};
  let finish;
  chrome.runtime.sendMessage=()=>new Promise(r=>finish=r);
  test.afterEach(() => { try { finish?.({ ok: false, code: "teardown" }); } catch {} });
  document.querySelector('[data-mail-action="read"]').click();
  document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  change({mailCache:{newValue:[{...cached,unread:false}]}});
  assert.equal(document.querySelectorAll('.card').length,0,'committed read hides even when cache lands first');
  finish({ok:true});await tick();
  assert.equal(document.querySelectorAll('.card').length,0,'confirmed read stays gone');
  assert.equal(document.getElementById('lifecycle-message').textContent,'','reads stay silent');
  change({mailCache:{newValue:[cached]}});
  assert.ok(document.querySelector('.card'),'a later unread reply can reappear');
});

test('uncertain recovery precedes mail, names its scope and leaves unrelated actions usable',async()=>{
  const {document,data,messages,change}=await workspaceFixture();
  const original=data.mailCache[0];
  const unrelated={...original,key:'gmail:work%40example.com:2',subject:'Other conversation'};
  change({mailCache:{newValue:[original,unrelated]},mailActions:{newValue:{[original.key]:{state:'uncertain',item:{key:original.key,provider:'gmail',account:original.account}}}}});
  const recovery=document.getElementById('mail-undo');
  assert.equal(recovery.nextElementSibling.id,'inbox-list','recovery is available before a long inbox');
  assert.match(recovery.getAttribute('aria-label'),/recovery/i);
  assert.match(recovery.textContent,/1 unconfirmed action/i);
  assert.match(recovery.textContent,/Other mail is still available/);
  const locked=document.querySelector(`[data-key="${original.key}"] [data-mail-action="trash"]`);
  const usable=document.querySelector(`[data-key="${unrelated.key}"] [data-mail-action="read"]`);
  assert.equal(locked.getAttribute('aria-disabled'),'true');
  assert.equal(usable.getAttribute('aria-disabled'),'false');
  usable.click();
  document.getElementById("unread-count").click();
  await tick();
  assert.equal(messages.at(-1).key,unrelated.key);
  document.querySelector('[data-recovery-account]').click();await tick();
  assert.equal(messages.at(-1).action,'acknowledge');
  assert.equal(messages.at(-1).key,original.key);
});

test('confirmed Gmail read stays silent and hidden even when cache arrives first',async()=>{
  const {document,change,data,tabs}=await workspaceFixture();
  const cached=data.mailCache[0];
  let finish;
  chrome.runtime.sendMessage=()=>new Promise(r=>finish=r);
  document.querySelector('[data-mail-action="read"]').click();
  document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  change({mailCache:{newValue:[]}});
  finish({ok:true});await tick();
  assert.equal(document.querySelectorAll('.card').length,0);
  assert.equal(document.getElementById('lifecycle-message').textContent,'','reads stay silent on success');
  assert.equal(tabs.length,0,'read must not open or reload provider tabs');
  change({mailCache:{newValue:[cached]}});
});

test('Gmail refresh guidance is not shown for failed reads and reads stay silent on success',async()=>{
  const {document}=await workspaceFixture();
  chrome.runtime.sendMessage=async()=>({ok:false,code:'check-mailbox'});
  document.querySelector('[data-mail-action="read"]').click();await tick();
  document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  await tick(); await tick();
  const error=document.getElementById('lifecycle-message').textContent;
  assert.doesNotMatch(error,/Marked as read|open Gmail.*refresh/i);
  assert.match(error,/I’ve checked/);
  const outlook={provider:'outlook',account:'studio@example.test'};
  const fixture=await workspaceFixture({accounts:[outlook],mailCache:[{...outlook,key:'outlook:studio%40example.test:one',unread:true,date:Date.now()}]});
  fixture.document.querySelector('[data-mail-action="read"]').click();await tick();await tick();
  fixture.document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  await tick(); await tick();
  assert.equal(fixture.document.querySelectorAll('.card').length,0,'committed Outlook read leaves');
  assert.equal(fixture.document.getElementById('lifecycle-message').textContent,'','successful reads stay silent');
});

test('thirty uncertain actions use one account recovery button and acknowledgement sends no mutations',async()=>{
  const {document,data,messages,change}=await workspaceFixture();
  const account=data.accounts[0];
  const other={provider:'gmail',account:'other@example.test'};
  const records=Object.fromEntries(Array.from({length:30},(_,i)=>['locked-'+i,{state:'uncertain',item:{...account,key:'locked-'+i}}]));
  records.foreign={state:'uncertain',item:{...other,key:'foreign'}};
  records.undo={state:'undo',item:{...account,key:'undo',subject:'Recoverable'},expiresAt:Date.now()+60000};
  change({accounts:{newValue:[account,other]},mailActions:{newValue:records}});
  const recovery=document.querySelector(`[data-recovery-account="gmail:${account.account}"]`);
  assert.ok(recovery);
  assert.equal(document.querySelectorAll('[data-recovery-account]').length,2);
  assert.equal(document.getElementById('mail-undo').children.length,2,'two account recoveries; completed Trash has no controls');
  assert.match(recovery.closest('li').textContent,/30 unconfirmed actions/);
  assert.match(recovery.getAttribute('aria-label'),/all 30 actions/);
  recovery.click();await tick();
  assert.equal(messages.length,30);
  assert.ok(messages.every(msg=>msg.action==='acknowledge'&&msg.key.startsWith('locked-')));
  assert.equal(document.querySelectorAll('[data-recovery-account]').length,1);
  assert.equal(document.querySelector('[data-undo-key]'),null,'completed Trash remains invisible');
  assert.match(document.getElementById('lifecycle-message').textContent,/30.*unlocked/);
});

test('account recovery resists duplicate clicks, keeps failures and leaves new uncertainty for another check',async()=>{
  const {document,data,messages,change}=await workspaceFixture();
  const account=data.accounts[0];
  const first={state:'uncertain',item:{...account,key:'first'}};
  const failed={state:'uncertain',item:{...account,key:'failed'}};
  change({mailActions:{newValue:{first,failed}}});
  let finish;
  chrome.runtime.sendMessage=async msg=>{
    messages.push(msg);
    if(msg.key==='first')await new Promise(resolve=>finish=resolve);
    if(msg.key==='failed')throw Error('connection interrupted');
    return {ok:true};
  };
  document.querySelector('[data-recovery-account]').click();
  const busy=document.querySelector('[data-recovery-account]');
  assert.equal(busy.getAttribute('aria-disabled'),'true');
  busy.click();assert.equal(messages.length,1);
  test.afterEach(() => { try { finish?.(); } catch {} });
  const newLock={state:'uncertain',item:{...account,key:'new'}};
  change({mailActions:{newValue:{first,failed,new:newLock}}});
  finish();await tick();
  assert.deepEqual(messages.map(msg=>msg.key),['first','failed'],'the click checks only its original snapshot');
  assert.match(document.querySelector('[data-recovery-account]').closest('li').textContent,/2 unconfirmed actions/);
  assert.equal(document.querySelector('[data-recovery-account]').getAttribute('aria-disabled'),'false');
  assert.match(document.getElementById('lifecycle-message').textContent,/1.*unlocked.*could not.*unlock/i);
});


test('saved completed deletions never reveal Undo on open, update or view changes', async () => {
  const item={provider:'gmail',account:'work@example.com',subject:'Deleted message'};
  const record={state:'undo',item,expiresAt:Date.now()+60000};
  const {document,change,messages}=await workspaceFixture({mailActions:{one:record}});
  const assertNoUndo=()=>{
    assert.ok(!document.getElementById('undo-tray'));
    assert.ok(!document.querySelector('[data-undo-key]'));
    assert.doesNotMatch(document.body.textContent,/Undo|available to restore/);
  };
  assertNoUndo();
  change({mailActions:{newValue:{one:record,two:{...record}}}});
  assertNoUndo();
  document.getElementById('open-settings').click();assertNoUndo();
  document.getElementById('back-to-mail').click();assertNoUndo();
  assert.equal(messages.length,0);
});

for (const code of ['unavailable','provider-error','pending','sign-in']) test(`mail action ${code} only requests sign-in for authentication failure`, async () => {
  const {document}=await workspaceFixture();
  chrome.runtime.sendMessage=async()=>({ok:false,code});
  document.querySelector('[data-mail-action="read"]').click();await tick();
  document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  await tick(); await tick();
  const text=document.getElementById('lifecycle-message').textContent;
  if (code==='sign-in') assert.match(text,/sign.in.*Settings/i);
  else assert.doesNotMatch(text,/sign.in|Settings/i);
});

test('successful Trash has concise feedback without advertising Undo',async()=>{
  const {document,messages}=await workspaceFixture();
  document.querySelector('[data-mail-action="trash"]').click();await tick();await tick();
  assert.equal(document.querySelectorAll('.card').length,0);
  assert.deepEqual(messages,[{type:'mail-action',key:'gmail:work%40example.com:1',action:'trash'}]);
  assert.equal(document.getElementById('lifecycle-message').textContent,'Moved to Trash.');
});

test('a stale action-state reread cannot replace a newer recovery storage event',async()=>{
  const item={provider:'gmail',account:'work@example.com'};
  const record={state:'uncertain',item,expiresAt:123};
  const {document,change}=await workspaceFixture({mailActions:{one:record}});
  const get=chrome.storage.local.get;
  let finish;
  chrome.storage.local.get=key=>key==='mailActions'?new Promise(resolve=>finish=resolve):get(key);
  document.querySelector('[data-mail-action="read"]').click();await tick();
  document.getElementById('unread-count').click(); // Leave the card to commit the staged read.
  await tick(); await tick();
  const newer={state:'uncertain',item:{...item,account:'newer@example.test'},expiresAt:456};
  change({accounts:{newValue:[item,newer.item]},mailActions:{newValue:{newer}}});
  finish({mailActions:{one:record}});await tick();
  assert.equal(document.querySelector('[data-recovery-account="gmail:work@example.com"]'),null);
  assert.ok(document.querySelector('[data-recovery-account="gmail:newer@example.test"]'));
});

test('whole account headings open one active inbox tab and retain focus through updates',async()=>{
  const accounts=[{provider:'gmail',account:'first@example.test'}, {provider:'gmail',account:'second@example.test',enabled:false},{provider:'outlook',account:'third@example.test'}];
  const {document,window,tabs,messages,change}=await workspaceFixture({accounts,mailCache:[],accountState:{'outlook:third@example.test':{needsSignIn:true}}});
  const links=[...document.querySelectorAll('.account-inbox')];
  assert.equal(links.length,3);
  links.forEach((link,i)=>{
    assert.equal(link.querySelector('h2').textContent,accounts[i].account);
    assert.equal(link.target,'_blank');
    link.click();
  });
  await tick();
  assert.equal(tabs.length,3);assert.ok(tabs.every(tab=>tab.active));assert.equal(messages.length,0);
  links[1].focus();change({mailCache:{newValue:[]}});
  assert.equal(document.activeElement.dataset.inboxAccount,'gmail:second@example.test');
  const modified=new window.Event('click',{bubbles:true,cancelable:true});modified.ctrlKey=true;
  document.activeElement.dispatchEvent(modified);await tick();assert.equal(tabs.length,3);assert.equal(modified.defaultPrevented,false);
  change({accounts:{newValue:[accounts[0]]}});assert.equal(document.activeElement.id,'refresh-mail');
});

test('global Mail checking form loads legacy precision and stays last in Settings',async()=>{
  const {document}=await workspaceFixture({pollIntervalMs:60000.5,accounts:[],mailCache:[]});
  assert.deepEqual([...document.querySelectorAll('#settings-view > section > h2')].map(h=>h.textContent),['Accounts','Themes','Notifications','Sound','Mail checking']);
  assert.equal(document.getElementById('poll-duration').value,'60.0005');
  assert.equal(document.getElementById('poll-unit').value,'seconds');
});
test('check frequency saves through worker, validates drafts and keeps pending status honest',async()=>{
  const {document,window,messages,change,data}=await workspaceFixture();
  const form=document.getElementById('poll-settings-form');assert.ok(form);
  const duration=document.getElementById('poll-duration'),unit=document.getElementById('poll-unit'),save=document.getElementById('poll-save');
  const edit=value=>{duration.value=value;duration.dispatchEvent(new window.Event('input'));};
  const submit=()=>form.dispatchEvent(new window.Event('submit',{cancelable:true}));
  edit('0.1');unit.value='seconds';submit();await tick();assert.equal(messages.length,0);assert.equal(duration.getAttribute('aria-invalid'),'true');
  assert.match(document.getElementById('poll-error').textContent,/30 seconds.*5 hours.*whole seconds/);
  edit('2');unit.value='minutes';let finish;
  chrome.runtime.sendMessage=msg=>{messages.push(msg);return new Promise(resolve=>finish=resolve);};
  test.afterEach(() => { try { finish?.({ ok: false, code: "teardown" }); } catch {} });
  duration.focus();submit();submit();assert.equal(messages.length,1);assert.equal(save.disabled,true);
  change({pollIntervalMs:{newValue:120000},mailCache:{newValue:[]},popupTheme:{newValue:'signal'}});
  assert.doesNotMatch(document.getElementById('poll-status').textContent,/Saved/);assert.equal(duration.value,'2');
  data.pollIntervalMs=120000;finish({ok:true,pollIntervalMs:120000});await tick();assert.equal(save.disabled,false);assert.match(document.getElementById('poll-status').textContent,/Saved/);
  const reopened=await workspaceFixture({pollIntervalMs:data.pollIntervalMs});assert.equal(reopened.document.getElementById('poll-duration').value,'2');
});
test('unrelated events preserve interval drafts and focus; worker failure permits retry',async()=>{
  const {document,window,change}=await workspaceFixture();
  const duration=document.getElementById('poll-duration');assert.ok(duration);
  const unit=document.getElementById('poll-unit'),form=document.getElementById('poll-settings-form');
  duration.value='3';duration.dispatchEvent(new window.Event('input'));duration.focus();
  change({pollIntervalMs:{newValue:180000},mailCache:{newValue:[]},accounts:{newValue:[]},popupTheme:{newValue:'slate'}});
  assert.equal(duration.value,'3');assert.equal(document.activeElement,duration);
  chrome.runtime.sendMessage=async()=>({ok:false,code:'save-failed',uncertain:true});
  form.dispatchEvent(new window.Event('submit',{cancelable:true}));await tick();await tick();
  assert.match(document.getElementById('poll-error').textContent,/could not be confirmed.*try again/i);
  assert.equal(duration.value,'3');assert.equal(unit.value,'minutes');assert.equal(document.getElementById('poll-save').disabled,false);
  chrome.runtime.sendMessage=async msg=>({ok:true,pollIntervalMs:msg.pollIntervalMs});
  form.dispatchEvent(new window.Event('submit',{cancelable:true}));await tick();assert.match(document.getElementById('poll-status').textContent,/Saved/);
});

test('a delayed initial interval read cannot overwrite successful Save or report a stale error',async()=>{
  for(const rejects of [false,true]) {
    let finish;
    const {document,window}=await workspaceFixture({},chrome=>{
      const get=chrome.storage.local.get;
      chrome.storage.local.get=key=>key==='pollIntervalMs'?new Promise((resolve,reject)=>{
        finish=()=>rejects?reject(new Error('old read failed')):resolve({pollIntervalMs:60000});
      }):get(key);
      chrome.runtime.sendMessage=async msg=>({ok:true,pollIntervalMs:msg.pollIntervalMs});
    });
    const duration=document.getElementById('poll-duration');
    duration.value='2';duration.dispatchEvent(new window.Event('input'));
    document.getElementById('poll-settings-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
    await tick();finish();await tick();
    assert.equal(duration.value,'2');assert.equal(document.getElementById('poll-unit').value,'minutes');
    assert.match(document.getElementById('poll-status').textContent,/Saved/);
    assert.equal(document.getElementById('poll-error').hidden,true);
  }
});
test('a newer interval event survives an older successful Save response without false success',async()=>{
  const {document,window,change}=await workspaceFixture();let finish;
  chrome.runtime.sendMessage=()=>new Promise(resolve=>finish=resolve);
  test.afterEach(() => { try { finish?.({ ok: false, code: "teardown" }); } catch {} });
  const duration=document.getElementById('poll-duration');duration.value='2';duration.dispatchEvent(new window.Event('input'));
  document.getElementById('poll-settings-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
  change({pollIntervalMs:{newValue:120000}});change({pollIntervalMs:{newValue:180000}});
  finish({ok:true,pollIntervalMs:120000});await tick();
  assert.equal(duration.value,'3');assert.equal(document.getElementById('poll-unit').value,'minutes');
  assert.doesNotMatch(document.getElementById('poll-status').textContent,/Saved/);
  assert.match(document.getElementById('poll-status').textContent,/changed while saving/i);
  assert.equal(document.getElementById('poll-save').disabled,false);
  chrome.runtime.sendMessage=async msg=>({ok:true,pollIntervalMs:msg.pollIntervalMs});
  document.getElementById('poll-settings-form').dispatchEvent(new window.Event('submit',{cancelable:true}));await tick();
  assert.equal(duration.value,'3');assert.match(document.getElementById('poll-status').textContent,/Saved/);
});

test('a preference event after Save clears success only when the effective interval changes',async()=>{
  const {document,window,change}=await workspaceFixture();
  chrome.runtime.sendMessage=async msg=>({ok:true,pollIntervalMs:msg.pollIntervalMs});
  const duration=document.getElementById('poll-duration');
  const status=document.getElementById('poll-status');
  duration.value='2';duration.dispatchEvent(new window.Event('input'));
  document.getElementById('poll-settings-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
  await tick();assert.match(status.textContent,/Saved/);
  change({pollIntervalMs:{newValue:120000}});
  assert.match(status.textContent,/Saved/,'the matching storage notification does not invalidate confirmed application');
  change({pollIntervalMs:{newValue:180000}});
  assert.equal(duration.value,'3');assert.equal(document.getElementById('poll-unit').value,'minutes');
  assert.equal(status.textContent,'','a different persisted preference is not proof of successful scheduling');
  assert.equal(document.getElementById('poll-save').disabled,false);
  document.getElementById('poll-settings-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
  await tick();assert.match(status.textContent,/Saved/,'an explicit successful Save can confirm the updated value');
});

function presetStates(document) {
  return [...document.querySelectorAll('.poll-presets button')].map(button => button.getAttribute('aria-pressed'));
}

test('poll presets fill fields without saving', async () => {
  const { document, window, messages, change } = await workspaceFixture({ pollIntervalMs: 60000 });
  const duration = document.getElementById('poll-duration');
  const unit = document.getElementById('poll-unit');
  const form = document.getElementById('poll-settings-form');
  const fiveMinutes = document.querySelector('.poll-presets [data-value="5"][data-unit="minutes"]');
  fiveMinutes.click();
  assert.equal(duration.value, '5');
  assert.equal(unit.value, 'minutes');
  assert.deepEqual(presetStates(document), ['false', 'false', 'true', 'false', 'false']);
  assert.deepEqual(messages, [], 'choosing a preset only fills the form');

  change({ pollIntervalMs: { newValue: 60000 } });
  assert.equal(duration.value, '5', 'external storage changes preserve a dirty preset draft');
  assert.deepEqual(presetStates(document), ['false', 'false', 'true', 'false', 'false']);

  chrome.runtime.sendMessage = async message => {
    messages.push(message);
    return { ok: true, pollIntervalMs: message.pollIntervalMs };
  };
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.deepEqual(messages, [{ type: 'set-poll-interval', pollIntervalMs: 300000 }]);
});

test('preset highlight follows initial asynchronous load', async () => {
  let resolveRead;
  const pendingRead = new Promise(resolve => { resolveRead = resolve; });
  const { document } = await workspaceFixture({}, chrome => {
    const get = chrome.storage.local.get;
    chrome.storage.local.get = key => key === 'pollIntervalMs' ? pendingRead : get(key);
  });
  resolveRead({ pollIntervalMs: 300000 });
  await tick();
  assert.equal(document.getElementById('poll-duration').value, '5');
  assert.equal(document.getElementById('poll-unit').value, 'minutes');
  assert.deepEqual(presetStates(document), ['false', 'false', 'true', 'false', 'false']);
});

test('preset highlight tracks manual duration and unit edits', async () => {
  const { document, window } = await workspaceFixture({ pollIntervalMs: 60000 });
  const duration = document.getElementById('poll-duration');
  const unit = document.getElementById('poll-unit');
  document.querySelector('.poll-presets [data-value="5"][data-unit="minutes"]').click();

  duration.value = '7';
  duration.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.deepEqual(presetStates(document), ['false', 'false', 'false', 'false', 'false']);

  duration.value = '5';
  duration.dispatchEvent(new window.Event('input', { bubbles: true }));
  unit.value = 'seconds';
  unit.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual(presetStates(document), ['false', 'false', 'false', 'false', 'false']);
});

test('preset highlight follows clean storage refill', async () => {
  const { document, change } = await workspaceFixture({ pollIntervalMs: 60000 });
  assert.deepEqual(presetStates(document), ['false', 'true', 'false', 'false', 'false']);
  change({ pollIntervalMs: { newValue: 300000 } });
  assert.equal(document.getElementById('poll-duration').value, '5');
  assert.equal(document.getElementById('poll-unit').value, 'minutes');
  assert.deepEqual(presetStates(document), ['false', 'false', 'true', 'false', 'false']);
});

test('successful Save normalizes fields and highlight without storage event', async () => {
  const { document, window, messages } = await workspaceFixture({ pollIntervalMs: 60000 });
  const duration = document.getElementById('poll-duration');
  const unit = document.getElementById('poll-unit');
  let finishSave;
  chrome.runtime.sendMessage = message => {
    messages.push(message);
    return new Promise(resolve => { finishSave = resolve; });
  };
  test.afterEach(() => { try { finishSave?.({ ok: false, code: 'teardown' }); } catch {} });

  duration.value = '300';
  duration.dispatchEvent(new window.Event('input', { bubbles: true }));
  unit.value = 'seconds';
  unit.dispatchEvent(new window.Event('change', { bubbles: true }));
  await tick();
  document.getElementById('poll-settings-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
  finishSave({ ok: true, pollIntervalMs: 300000 });
  await Promise.resolve();

  assert.deepEqual(messages, [{ type: 'set-poll-interval', pollIntervalMs: 300000 }]);
  assert.equal(duration.value, '5');
  assert.equal(unit.value, 'minutes');
  assert.deepEqual(presetStates(document), ['false', 'false', 'true', 'false', 'false']);
  assert.match(document.getElementById('poll-status').textContent, /Saved/);
});

test('pending Save preserves draft until response', async () => {
  const { document, window, messages, change } = await workspaceFixture({ pollIntervalMs: 60000 });
  const duration = document.getElementById('poll-duration');
  const unit = document.getElementById('poll-unit');
  const form = document.getElementById('poll-settings-form');
  let finishSave;
  chrome.runtime.sendMessage = message => {
    messages.push(message);
    return new Promise(resolve => { finishSave = resolve; });
  };
  test.afterEach(() => { try { finishSave?.({ ok: false, code: 'teardown' }); } catch {} });

  document.querySelector('.poll-presets [data-value="5"][data-unit="minutes"]').click();
  form.dispatchEvent(new window.Event('submit', { cancelable: true }));
  change({ pollIntervalMs: { newValue: 60000 } });
  assert.equal(duration.value, '5');
  assert.equal(unit.value, 'minutes');
  assert.deepEqual(presetStates(document), ['false', 'false', 'true', 'false', 'false']);

  finishSave({ ok: true, pollIntervalMs: 300000 });
  await Promise.resolve();
  assert.equal(duration.value, '1');
  assert.equal(unit.value, 'minutes');
  assert.deepEqual(presetStates(document), ['false', 'true', 'false', 'false', 'false']);
  assert.match(document.getElementById('poll-status').textContent, /changed while saving/i);
  assert.deepEqual(messages, [{ type: 'set-poll-interval', pollIntervalMs: 300000 }]);
});
