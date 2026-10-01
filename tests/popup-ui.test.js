import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
const tick = () => new Promise((r) => setTimeout(r, 0));
test("popup lifecycle controls send worker messages and static previews never write cache", async () => {
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
  assert.equal(card.querySelector(".card-summary"), null, "no preview toggle");
  assert.equal(card.querySelector(".card-preview"), null, "no expanded content");
  assert.equal(card.querySelector(".card-snippet").textContent, cached.snippet);
  assert.ok(card.querySelector(".card-head .card-subject"));
  assert.equal(card.querySelector("script"), null, "mail remains plain text");
  assert.equal(writes, 0);
  assert.equal(messages.length, 0, "displaying preview never marks read");
  const open = card.querySelector(".card-open");
  open.focus();
  storageListener({ mailCache: { newValue: [cached] } }, "local");
  assert.equal(document.activeElement, document.querySelector(".card-open"));
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
  assert.ok(sections[0].querySelector(".card-snippet"));
  assert.equal(messages.length, 0, "preview is visible without interaction");
  assert.equal(sections[0].querySelector(".account-count").textContent, "2 unread");
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
  const remaining = document.querySelector('.card-open');
  remaining.focus();
  change({ mailCache: { newValue: [] } });
  assert.equal(document.activeElement, document.getElementById("refresh-mail"), "removed mail focus returns to Mail control");
});

test("workspace themes persist without replacing focused controls or draft form input", async () => {
  const { document, window, data, change } = await workspaceFixture({ popupTheme: "slate" });
  assert.equal(document.documentElement.dataset.theme, "slate");
  document.getElementById("open-settings").click();
  document.getElementById("add-gmail").click();
  const draft = document.getElementById("add-account-email");
  draft.value = "unfinished@example.com";
  const signal = document.querySelector('input[name="popup-theme"][value="signal"]');
  signal.focus(); signal.checked = true;
  signal.dispatchEvent(new window.Event("change", { bubbles: true }));
  await tick();
  assert.equal(document.documentElement.dataset.theme, "signal");
  assert.equal(document.activeElement, signal);
  assert.equal(draft.value, "unfinished@example.com");
  assert.equal(data.popupTheme, "signal");
  change({ popupTheme: { newValue: "slate" } });
  assert.equal(document.documentElement.dataset.theme, "slate");
  assert.equal(document.activeElement, signal, "external preference update preserves focus");
  const next = await workspaceFixture({ popupTheme: data.popupTheme });
  assert.equal(next.document.documentElement.dataset.theme, "signal", "reopen loads saved choice");
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

test("opened mail keeps provider counts with an opened-here marker", async () => {
  const now = Date.now();
  const mail = (id, extra = {}) => ({ key: `gmail:work%40example.com:${id}`, provider: "gmail",
    account: "work@example.com", from: "Sender", subject: id, snippet: "text",
    date: now, unread: true, ...extra });
  const { document, change } = await workspaceFixture({
    mailCache: [mail("one"), mail("two")],
  });
  assert.equal(document.querySelector(".account-count").textContent, "2 unread");
  assert.equal(document.getElementById("unread-count").textContent, "(2)");
  document.querySelector(".card-open").click();
  await tick();
  assert.equal(document.getElementById("unread-count").textContent, "(2) \u00B7 1 opened");
  change({ mailCache: { newValue: [mail("one", { localRead: true }), mail("two")] } });
  assert.equal(document.querySelector(".account-count").textContent, "2 unread \u00B7 1 opened here");
  assert.equal(document.querySelector(".opened-tag")?.textContent, "Opened here");
  assert.match(document.querySelector(".card-open").getAttribute("aria-label"), /opened here/);
});

test("cards show automatic plain-text previews without expansion or content click actions", async () => {
  const { document, messages, tabs } = await workspaceFixture();
  const card = document.querySelector(".card");
  assert.ok(card.querySelector(".card-snippet"));
  assert.equal(card.querySelector(".preview-cue"), null);
  assert.equal(card.querySelector("[aria-expanded]"), null);
  card.click();
  assert.equal(messages.length, 0);
  assert.equal(tabs.length, 0, "in-extension reading is deferred");
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

test('hover actions use provider-specific labels and resist duplicate clicks', async () => {
  const { document, messages, change } = await workspaceFixture();
  const read = document.querySelector('[data-mail-action="read"]');
  assert.match(read.getAttribute('aria-label'),/conversation as read/);
  assert.match(document.querySelector('[data-mail-action="trash"]').getAttribute('aria-label'),/conversation to Trash/);
  let finish;
  chrome.runtime.sendMessage=async msg=>{messages.push(msg);await new Promise(r=>finish=r);return {ok:true};};
  read.focus();read.click();
  const pending=document.querySelector('[data-mail-action="read"]');
  assert.equal(pending.getAttribute('aria-disabled'),'true');
  pending.click();assert.equal(messages.length,1);
  assert.equal(messages[0].type,'mail-action');assert.equal(messages[0].action,'read');
  finish();await tick();
  change({mailActions:{newValue:{one:{state:'undo',expiresAt:Date.now()+60000,item:{provider:'gmail',account:'work@example.com',subject:'Test'}}}}});
  assert.equal(document.getElementById('mail-undo').hidden,false);
  assert.match(document.querySelector('[data-undo-key]').getAttribute('aria-label'),/Restore Test/);
});

test('mailbox feedback is immediate while worker is pending and rolls back a failed action',async()=>{
  const {document,change}=await workspaceFixture();
  const key=document.querySelector('.card').dataset.key;
  let finish;
  chrome.runtime.sendMessage=()=>new Promise(r=>finish=r);
  document.querySelector('[data-mail-action="read"]').click();
  assert.ok(document.querySelector('.card').classList.contains('read'),'read style changes before worker response');
  change({mailCache:{newValue:[{key,provider:'gmail',account:'work@example.com',subject:'new cache text',snippet:'text',date:Date.now(),unread:true}]}});
  assert.ok(document.querySelector('.card').classList.contains('read'),'stale cache cannot restore unread while pending');
  finish({ok:false,code:'provider-error'});await tick();
  assert.equal(document.querySelector('.card').classList.contains('read'),false,'failure restores unread card');
  document.querySelector('[data-mail-action="trash"]').click();
  assert.equal(document.querySelector('.card'),null,'Trash hides card before worker response');
  finish({ok:false,code:'provider-error'});await tick();
  assert.ok(document.querySelector('.card'),'failed Trash restores card');
});

test('provider-read cards are filtered out',async()=>{
  const {document,change}=await workspaceFixture();
  const key=document.querySelector('.card').dataset.key;
  change({mailCache:{newValue:[{key,provider:'gmail',account:'work@example.com',date:Date.now(),unread:false}]}});
  assert.equal(document.querySelector('.card'),null,'server-read mail is no longer needed in popup');
});


test('confirmed read feedback resists stale unread cache until reconciliation, then allows new unread mail',async()=>{
  const {document,change,data}=await workspaceFixture();
  const cached=data.mailCache[0];
  let finish;
  chrome.runtime.sendMessage=()=>new Promise(r=>finish=r);
  document.querySelector('[data-mail-action="read"]').click();
  finish({ok:true});await tick();
  assert.equal(document.querySelector('.card'),null);
  change({mailCache:{newValue:[cached]}});
  assert.equal(document.querySelector('.card'),null,'stale unread snapshot cannot undo confirmed feedback');
  change({mailCache:{newValue:[{...cached,unread:false}]}});
  change({mailCache:{newValue:[{...cached,date:Date.now()+1000}]}});
  assert.ok(document.querySelector('.card'),'a later unread reply in the same conversation can appear');
});

test('read cache arriving before action response settles feedback and allows later unread mail',async()=>{
  const {document,change,data}=await workspaceFixture();
  const cached=data.mailCache[0];
  let finish;
  chrome.runtime.sendMessage=()=>new Promise(r=>finish=r);
  document.querySelector('[data-mail-action="read"]').click();
  change({mailCache:{newValue:[{...cached,unread:false}]}});
  assert.ok(document.querySelector('.card.read'),'pending feedback stays visible through storage event');
  finish({ok:true});await tick();
  assert.equal(document.querySelector('.card'),null);
  change({mailCache:{newValue:[cached]}});
  assert.ok(document.querySelector('.card'),'future unread state can appear after cache/response handoff');
});

test('uncertain recovery precedes mail, names its scope and leaves unrelated actions usable',async()=>{
  const {document,data,messages,change}=await workspaceFixture();
  const original=data.mailCache[0];
  const unrelated={...original,key:'gmail:work%40example.com:2',subject:'Other conversation'};
  change({mailCache:{newValue:[original,unrelated]},mailActions:{newValue:{[original.key]:{state:'uncertain',item:{key:original.key,provider:'gmail',account:original.account}}}}});
  const recovery=document.getElementById('mail-undo');
  assert.equal(recovery.nextElementSibling.id,'inbox-list','recovery is available before a long inbox');
  assert.match(recovery.getAttribute('aria-label'),/recovery/i);
  assert.match(recovery.textContent,/this conversation/i);
  assert.match(recovery.textContent,/Other mail is still available/);
  const locked=document.querySelector(`[data-key="${original.key}"] [data-mail-action="trash"]`);
  const usable=document.querySelector(`[data-key="${unrelated.key}"] [data-mail-action="trash"]`);
  assert.equal(locked.getAttribute('aria-disabled'),'true');
  assert.equal(usable.getAttribute('aria-disabled'),'false');
  usable.click();await tick();
  assert.equal(messages.at(-1).key,unrelated.key);
  document.querySelector('[data-undo-key]').click();await tick();
  assert.equal(messages.at(-1).action,'acknowledge');
  assert.equal(messages.at(-1).key,original.key);
});

test('confirmed Gmail read explains open-page refresh even when cache arrives first',async()=>{
  const {document,change,data,tabs}=await workspaceFixture();
  const cached=data.mailCache[0];
  let finish;
  chrome.runtime.sendMessage=()=>new Promise(r=>finish=r);
  document.querySelector('[data-mail-action="read"]').click();
  change({mailCache:{newValue:[]}});
  finish({ok:true});await tick();
  assert.equal(document.querySelector('.card'),null);
  assert.match(document.getElementById('lifecycle-message').textContent,/Marked as read.*open Gmail.*refresh/i);
  assert.equal(tabs.length,0,'read must not open or reload provider tabs');
  change({mailCache:{newValue:[cached]}});
});

test('Gmail refresh guidance is not shown for failed reads or Outlook',async()=>{
  const {document}=await workspaceFixture();
  chrome.runtime.sendMessage=async()=>({ok:false,code:'check-mailbox'});
  document.querySelector('[data-mail-action="read"]').click();await tick();
  const error=document.getElementById('lifecycle-message').textContent;
  assert.doesNotMatch(error,/Marked as read|open Gmail.*refresh/i);
  assert.match(error,/I’ve checked/);
  const outlook={provider:'outlook',account:'studio@example.test'};
  const fixture=await workspaceFixture({accounts:[outlook],mailCache:[{...outlook,key:'outlook:studio%40example.test:one',unread:true,date:Date.now()}]});
  fixture.document.querySelector('[data-mail-action="read"]').click();await tick();
  assert.equal(fixture.document.getElementById('lifecycle-message').textContent,'Marked as read in your mailbox.');
});
