// Browser-only synthetic fixture. Never reads a real account or extension store.
const state = new URLSearchParams(location.search).get("state") ?? "populated";
if (!["empty", "populated", "expanded", "signed-out", "error", "long", "undo"].includes(state)) {
  throw new Error("Unknown popup fixture state");
}

const accounts = [
  { provider: "gmail", account: "work@example.com" },
  { provider: "gmail", account: "personal@example.com" },
  { provider: "outlook", account: "outlook@example.com" },
];
if (state === "long") accounts[0].account = "long-account-" + "a".repeat(65) + "@example.com";
const date = Date.parse("2026-09-29T08:00:00Z");
const mail = accounts.map((account, index) => ({
  ...account,
  key: `${account.provider}:${encodeURIComponent(account.account)}:fixture-${index}`,
  from: ["Alex", "Morgan", "Sam"][index],
  subject: ["Project review", "Weekend plans", "Your booking confirmation"][index],
  snippet: [
    "The updated draft is ready for review. Please share your feedback before Friday.",
    "Shall we meet for lunch on Saturday? Let me know what works for you.",
    "Your reservation is confirmed. All the details are available in your mailbox.",
  ][index],
  date: date - index * 60_000,
  unread: index !== 1,
  localRead: false,
}));
if (state === "long") {
  mail[0].subject = "A long subject " + "unbrokentext".repeat(20);
  mail[0].snippet = "A long cached preview " + "longtext".repeat(60);
}
const data = {
  accounts: state === "empty" ? [] : accounts,
  mailCache: state === "empty" ? [] : mail,
  soundSettings: { masterMuted: false, volume: 0.5, mutedAccounts: {} },
  skipFocusedProvider: false,
  accountState: state === "signed-out"
    ? { "outlook:outlook@example.com": { needsSignIn: true } }
    : state === "error"
      ? {
        "gmail:work@example.com": { offline: true },
        "outlook:outlook@example.com": { backedOff: true, status: 429 },
      }
      : {},
};
if (state === "undo") {
  data.mailActions = Object.fromEntries(Array.from({length: 12}, (_, index) => ["undo-" + index, {
    state: "undo", expiresAt: Date.now() + (index + 1) * 45000,
    item: {...accounts[index % accounts.length], subject: "Deleted message " + (index + 1)},
  }]));
}
const listeners = [];
const messages = [];
const openedUrls = [];

globalThis.chrome = {
  storage: {
    local: {
      get: async (key) => ({ [key]: structuredClone(data[key]) }),
      set: async (values) => {
        const changes = {};
        for (const [key, value] of Object.entries(values)) {
          changes[key] = { oldValue: data[key], newValue: value };
          data[key] = structuredClone(value);
        }
        for (const listener of listeners) listener(changes, "local");
      },
    },
    onChanged: { addListener: (listener) => listeners.push(listener) },
  },
  runtime: {
    sendMessage: async (message, callback) => {
      messages.push(message);
      const result = message.type === 'set-poll-interval'
        ? {ok:true,pollIntervalMs:message.pollIntervalMs} : {ok:true};
      if(message.type === 'set-poll-interval') await chrome.storage.local.set({pollIntervalMs:message.pollIntervalMs});
      callback?.(result);
      return result;
    },
  },
  tabs: { create: (options) => openedUrls.push(options.url) },
};
globalThis.popupFixture = { state, messages, openedUrls, data, change: (changes) => listeners.forEach(listener => listener(changes, "local")) };

const response = await fetch("../../src/popup/popup.html");
if (!response.ok) throw new Error("Unable to load production popup HTML");
const template = new DOMParser().parseFromString(await response.text(), "text/html");
template.querySelectorAll("script").forEach((script) => script.remove());
document.body.replaceChildren(...template.body.childNodes);
document.title = `Popup baseline: ${state} (synthetic data)`;
await import("../../src/popup/popup.js");
await new Promise(requestAnimationFrame);
// Legacy expanded fixture now uses the always-visible production preview.
document.documentElement.dataset.fixtureReady = state;
