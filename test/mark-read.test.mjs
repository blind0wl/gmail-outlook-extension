import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const popupSource = await readFile(new URL("../src/popup/popup.js", import.meta.url), "utf8");
const enabledButton = { getAttribute: () => "false" };

// Run the real popup interaction with rendering stubbed out. No unload event
// or timer fires: the message must already be owned by the background worker.
function popup(items, sendMessage) {
  const timers = new Map();
  let nextTimer = 0;
  const context = vm.createContext({
    document: { readyState: "loading", addEventListener() {} },
    chrome: { runtime: { sendMessage } },
    setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    seed: items.map((item) => ({ ...item })),
  });
  const hooks = `
    items = seed;
    renderHeader = renderList = renderRecovery = function () {};
    syncMailActions = async function () {};
    setStatus = function () {};
    globalThis.popup = { activateMailAction, stageRead, displayedItems, toggleCard,
      stagedReads, pendingMailActions, mailErrors };
  `;
  vm.runInContext(popupSource.replace(/^import .*;\n/gm, "").replace(/\}\)\(\);\s*$/, hooks + "})();"), context);
  return { ...context.popup, timers };
}

const messages = ["gmail", "gmail", "outlook"].map((provider, index) => ({
  key: `${provider}:account${index}%40example.com:abc${index}`,
  provider,
  account: `account${index}@example.com`,
  from: "sender@example.com",
  subject: "Example message",
  snippet: "Example preview",
  date: Date.now(),
  unread: true,
  localRead: false,
}));

for (const item of messages) {
  test(`explicit read dispatches immediately for ${item.provider} ${item.account}`, async () => {
    const requests = [];
    let finish;
    const ui = popup([item], (request) => {
      requests.push(request);
      return new Promise((resolve) => { finish = resolve; });
    });
    ui.activateMailAction(item.key, "read", enabledButton);
    assert.equal(requests.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(requests[0])), { type: "mail-action", key: item.key, action: "read" });
    assert.equal(ui.stagedReads.size, 0);
    assert.equal(ui.timers.size, 0);
    assert.equal(ui.pendingMailActions.has(item.key), true);
    assert.equal(ui.displayedItems().length, 0);
    // A repeated activation during the request must not reverse or replay it.
    ui.activateMailAction(item.key, "read", enabledButton);
    assert.equal(requests.length, 1);
    finish({ ok: true });
    await new Promise(setImmediate);
    assert.equal(ui.pendingMailActions.size, 0);
  });
}

test("failed explicit reads restore the unread card and error", async () => {
  const item = messages[0];
  const ui = popup([item], async () => ({ ok: false, code: "unavailable" }));
  ui.activateMailAction(item.key, "read", enabledButton);
  await new Promise(setImmediate);
  assert.equal(ui.displayedItems()[0].unread, true);
  assert.match(ui.mailErrors[item.key], /Could not complete the action/);
});

test("automatic staged reads can still be cancelled without a provider write", () => {
  const item = messages[0];
  const requests = [];
  const ui = popup([item], async (request) => { requests.push(request); return { ok: true }; });
  ui.stageRead(item.key);
  assert.equal(ui.displayedItems()[0].unread, false);
  ui.activateMailAction(item.key, "read", enabledButton);
  assert.equal(ui.stagedReads.size, 0);
  assert.equal(ui.timers.size, 0);
  assert.equal(ui.displayedItems()[0].unread, true);
  assert.equal(requests.length, 0);
});

test("collapsing an opened email sends its staged read", () => {
  const item = messages[0];
  const requests = [];
  const ui = popup([item], (request) => { requests.push(request); return new Promise(() => {}); });
  const classes = new Set();
  const card = { classList: {
    contains: (name) => classes.has(name),
    remove: (name) => classes.delete(name),
    toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
  } };
  const toggle = { dataset: {}, setAttribute() {} };
  ui.toggleCard(card, toggle, item.key, true);
  ui.stageRead(item.key);
  assert.equal(requests.length, 0);
  ui.toggleCard(card, toggle, item.key, false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].action, "read");
  assert.equal(ui.stagedReads.size, 0);
  assert.equal(ui.displayedItems().length, 0);
});

test("worker completes and persists explicit reads after the popup is discarded", async () => {
  const values = { accounts: messages.map(({ provider, account }) => ({ provider, account })), mailCache: messages };
  globalThis.chrome = {
    storage: { local: {
      async get(key) { return { [key]: values[key] }; },
      async set(patch) { Object.assign(values, patch); },
    } },
  };
  const worker = await import("../src/background/service-worker.js");
  await worker.ready;
  for (const item of messages) {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const calls = [];
    let operation;
    let ui = popup([item], (request) => {
      operation = worker.handleMessage(request, {
        getToken: async () => null,
        setBadge: async () => {},
        mutate: async (account, id, action) => {
          calls.push({ account, id, action });
          await gate;
          return { id };
        },
      });
      return operation;
    });
    ui.activateMailAction(item.key, "read", enabledButton);
    // Discard popup state without giving its timers or close handlers a turn.
    ui = null;
    await new Promise(setImmediate);
    assert.equal(values.mailActions[item.key].state, "pending");
    assert.equal(values.mailCache.find((entry) => entry.key === item.key).unread, true);
    release();
    assert.deepEqual(await operation, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].account.account, item.account);
    assert.equal(calls[0].action, "read");
    const saved = values.mailCache.find((entry) => entry.key === item.key);
    assert.equal(saved.unread, false);
    assert.equal(saved.localRead, false);
    assert.equal(values.mailActions[item.key], undefined);
    const reopened = popup(values.mailCache, async () => ({ ok: true }));
    assert.equal(reopened.displayedItems().some((entry) => entry.key === item.key), false);
  }
});
