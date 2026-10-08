import test from "node:test";
import assert from "node:assert/strict";

function storageDouble(seed = {}) {
  const values = { ...seed };
  return {
    values,
    async get(keys) {
      if (keys == null) return { ...values };
      if (Array.isArray(keys))
        return Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]]));
      if (typeof keys === "object")
        return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, values[key] ?? fallback]));
      return keys in values ? { [keys]: values[keys] } : {};
    },
    async set(patch) { Object.assign(values, patch); },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
    },
  };
}

function eventDouble() {
  const listeners = [];
  return { listeners, addListener(listener) { listeners.push(listener); } };
}

test("worker detects newer codes in opened Gmail threads and invalidates stale codes", async () => {
  const account = { provider: "gmail", account: "codes@example.com", enabled: true, notify: true };
  const local = storageDouble({ accounts: [account], authCodeAutoCopyEnabled: false });
  const session = storageDouble();
  const alarms = new Map();
  const notifications = new Map();
  const clearedNotifications = [];
  const clipboardWrites = [];
  let offscreenExists = false;
  globalThis.chrome = {
    storage: { local, session },
    alarms: {
      onAlarm: eventDouble(),
      async get(name) { return alarms.get(name); },
      async create(name, options) { alarms.set(name, options); },
      async clear(name) { alarms.delete(name); },
    },
    runtime: {
      onStartup: eventDouble(),
      onInstalled: eventDouble(),
      onMessage: eventDouble(),
      getURL: (path) => `chrome-extension://test/${path}`,
      async getContexts() { return offscreenExists ? [{ contextType: "OFFSCREEN_DOCUMENT" }] : []; },
      async sendMessage(message) {
        if (message.type === "copy-auth-code-to-clipboard") clipboardWrites.push(message.code);
        return { ok: true };
      },
    },
    offscreen: {
      async createDocument() { offscreenExists = true; },
      async hasDocument() { return offscreenExists; },
    },
    notifications: {
      onButtonClicked: eventDouble(),
      onClicked: eventDouble(),
      async create(id, details) { notifications.set(id, details); return id; },
      async clear(id) { notifications.delete(id); clearedNotifications.push(id); return true; },
      async update() { return true; },
    },
    action: {
      async setBadgeText() {},
      async setBadgeBackgroundColor() {},
    },
  };

  const worker = await import("../src/background/service-worker.js");
  const sessionStore = await import("../src/auth-codes/session.js");
  await worker.ready;

  let now = Date.now();
  const key = "gmail:codes%40example.com:thread-1";
  let message = {
    key,
    provider: "gmail",
    account: account.account,
    from: "Example Identity <support@example.com>",
    subject: "Your sign-in verification code",
    snippet: "A code was sent to your inbox.",
    date: now - 4_000,
    unread: true,
    localRead: false,
  };
  let generalNotices = 0;
  const poll = () => worker.pollAll([account], {
    now,
    getToken: async () => null,
    fetchers: { gmail: async () => [message] },
    readBody: async () => ({ content: "Verification code: 041829", contentType: "text" }),
    setBadge: async () => {},
    readSoundSettings: async () => ({ masterMuted: true, volume: 0, mutedAccounts: {} }),
    notify: async () => { generalNotices++; },
  });

  // The first poll establishes the account baseline and is intentionally quiet.
  await poll();
  await worker.handleMarkRead(key, [account], { setBadge: async () => {} });

  // Gmail reuses a thread key. localRead remains sticky after a later message.
  now += 1_000;
  message = { ...message, date: now - 2_000, snippet: "A newer verification message arrived." };
  await poll();
  assert.equal((await sessionStore.getPendingAuthCode(key, now)).code, "041829");
  assert.equal(generalNotices, 0, "an opened thread update is code-only, not a generic mail alert");
  assert.equal([...notifications.values()].filter((notice) => notice.buttons?.[0]?.title === "Copy code").length, 1);

  // A newer ambiguous message supersedes the old thread code and its action.
  now += 1_000;
  message = { ...message, date: now - 1_000, snippet: "A newer verification code is available." };
  const readBody = async () => ({
    content: "Verification code 041829. Replacement verification code 773501.",
    contentType: "text",
  });
  await worker.pollAll([account], {
    now,
    getToken: async () => null,
    fetchers: { gmail: async () => [message] },
    readBody,
    setBadge: async () => {},
    readSoundSettings: async () => ({ masterMuted: true, volume: 0, mutedAccounts: {} }),
    notify: async () => { generalNotices++; },
  });
  assert.equal(await sessionStore.getPendingAuthCode(key, now), null);
  assert.equal(local.values.mailCache.find((item) => item.key === key).authCodeAvailable, false);
  assert.equal(notifications.size, 0, "the older Copy code notification is removed");
  assert.ok(clearedNotifications.length > 0);
  assert.deepEqual(clipboardWrites, []);
  assert.equal(generalNotices, 0, "ambiguous code-only updates do not become generic alerts");

  // A later unambiguous version restores Copy code and labels the sender,
  // without placing any code in notification title/body/context.
  now += 1_000;
  message = { ...message, date: now - 500, snippet: "Your newer sign-in code is ready." };
  await worker.pollAll([account], {
    now,
    getToken: async () => null,
    fetchers: { gmail: async () => [message] },
    readBody: async () => ({ content: "Verification code: 984201", contentType: "text" }),
    setBadge: async () => {},
    readSoundSettings: async () => ({ masterMuted: true, volume: 0, mutedAccounts: {} }),
  });
  const currentNotice = [...notifications.values()].find((notice) => notice.buttons?.[0]?.title === "Copy code");
  assert.ok(currentNotice);
  assert.match(currentNotice.contextMessage, /Example Identity/);
  assert.equal(JSON.stringify(currentNotice).includes("984201"), false);
  assert.equal((await sessionStore.getPendingAuthCode(key, now)).code, "984201");
});
