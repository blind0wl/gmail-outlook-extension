// Synthetic Chrome boundary only. Production HTML, CSS and JS are reused verbatim.
const params = new URLSearchParams(location.search);
const accounts = [
  { provider: "gmail", account: "work@example.test" },
  { provider: "gmail", account: "personal@example.test" },
  { provider: "outlook", account: "studio@example.test" },
  { provider: "outlook", account: "paused@example.test", enabled: false },
];
if (params.has("long")) accounts[0].account = "a-very-long-account-address-for-checking-wrapping@a-long-example-domain.test";
const subjects = ["Your weekly reading list", "Project notes for Thursday", "An update from the studio", "Weekend plans"];
const mailCache = subjects.map((subject, i) => ({
  key: `synthetic-${i}`, provider: accounts[i < 2 ? 0 : i - 1].provider,
  account: accounts[i < 2 ? 0 : i - 1].account,
  from: ["Reading room", "Morgan Lee", "The studio", "Alex Chen"][i], subject,
  snippet: "A few details to catch up on, with everything you need for the week ahead. The reading room opens early on Thursday, and the updated notes include the complete schedule, suggested reading, and a few questions for our next conversation. There is more to explore in your mailbox.",
  date: Date.now() - i * 3600000, unread: true,
  webLink: "https://outlook.live.com/mail/deeplink/read/synthetic",
}));
if (params.has("long")) mailCache[0].snippet = "Long unbroken content: " + "preview".repeat(80);
const data = { accounts, mailCache: params.has("empty") ? [] : mailCache,
  accountState: params.has("error") ? { "gmail:personal@example.test": { needsSignIn: true }, "outlook:studio@example.test": { offline: true } } : {},
  popupTheme: params.get("theme") || "midnight", soundSettings: { masterMuted: false, volume: 0.5, mutedAccounts: {} } };
if (params.has("recovery-count")) {
  const count = Math.min(200, Math.max(1, Number(params.get("recovery-count")) || 1));
  data.mailActions = Object.fromEntries(Array.from({ length: count }, (_, i) => {
    const key = i === 0 ? "synthetic-0" : "synthetic-uncertain-" + i;
    return [key, { state: "uncertain", action: "trash", expiresAt: Date.now() + 600000, item: { key, provider: accounts[0].provider, account: accounts[0].account } }];
  }));
}
const listeners = [];
const requests = [];
function update(patch) {
  const changes = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, { oldValue: data[key], newValue: value }]));
  Object.assign(data, patch);
  listeners.forEach(listener => listener(changes, "local"));
}
Object.defineProperty(globalThis, "chrome", { configurable: true, value: {
  storage: { local: { get: async key => ({ [key]: data[key] }), set: async patch => {
    if (params.has("save-error") && "popupTheme" in patch) throw Error("Synthetic storage error");
    update(patch);
  } }, onChanged: { addListener: listener => listeners.push(listener) } },
  runtime: { sendMessage: async message => { requests.push(message);
    if (params.has("pending")) await new Promise(resolve => setTimeout(resolve, 5000));
    if (params.has("action-error")) throw Error("Synthetic action error");
    if (message.type === "mail-action") {
      const records = { ...(data.mailActions || {}) };
      const item = data.mailCache.find(i => i.key === message.key);
      if (params.has("uncertain") && message.action === "trash" && message.key === "synthetic-0") {
        records[message.key] = { state: "uncertain", action: "trash", item: { key: item.key, provider: item.provider, account: item.account } };
        update({ mailActions: records });
        return { ok: false, code: "check-mailbox" };
      }
      if (message.action === "acknowledge" && records[message.key]) {
        if (!["pending", "uncertain"].includes(records[message.key].state)) return { ok: false, code: "check-mailbox" };
        if (message.expectedExpiresAt !== undefined && message.expectedExpiresAt !== (records[message.key].expiresAt ?? null)) return { ok: false, code: "check-mailbox" };
        delete records[message.key];
        update({ mailActions: records });
      }
      if (message.action === "read" && item) update({ mailCache: data.mailCache.map(i => i.key === message.key ? { ...i, unread: false, localRead: false } : i) });
      if (message.action === "trash" && item) {
        records[message.key] = { state: "undo", item, id: message.key, expiresAt: Date.now() + 600000 };
        update({ mailCache: data.mailCache.filter(i => i.key !== message.key), mailActions: records });
      }
      if (message.action === "undo" && records[message.key]) {
        const restored = records[message.key].item;
        delete records[message.key];
        update({ mailCache: [...data.mailCache, restored], mailActions: records });
      }
    }
    if (message.type === "remove-account") update({ accounts: data.accounts.filter(a => a.account !== message.account) });
    return { ok: true };
  } }, tabs: { create: async ({url}) => { requests.push({ type: "synthetic-open", url }); } },
} });
// Exposed only on this synthetic page, for reproducing live cache/account changes.
globalThis.fixture = { data, requests, update };
const html = await (await fetch("../../src/popup/popup.html")).text();
const parsed = new DOMParser().parseFromString(html, "text/html");
parsed.querySelector("script").remove();
parsed.querySelector("link").href = "/src/popup/popup.css";
document.documentElement.dataset.theme = "midnight";
document.head.replaceChildren(...parsed.head.childNodes);
document.body.replaceChildren(...parsed.body.childNodes);
document.body.dataset.themeLoading = "";
await import("../../src/popup/popup.js");
