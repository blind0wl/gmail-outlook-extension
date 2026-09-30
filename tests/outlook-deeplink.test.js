import test from "node:test";
import assert from "node:assert/strict";
import { fetchOutlookMessages } from "../src/providers/outlook.js";
import { mergeMessages, getInbox, pruneCache, setLocalRead } from "../src/store/cache.js";
import { persistCache, hydrateCache } from "../src/notify/notify.js";
import { threadUrl } from "../src/popup/links.js";

const webLink = "https://outlook.live.com/owa/?ItemID=AAMk%2B%2F%3D&exvsurl=1&viewmodel=ReadMessageItem";
const item = { key: "outlook:you%40outlook.com:AAMk+/=", provider: "outlook", account: "you@outlook.com" };
const fallback = "https://outlook.live.com/mail/you%40outlook.com/inbox/id/AAMk%2B%2F%3D";

test("Outlook Open retains Graph's encoded message URL through refresh and cache restart", async (t) => {
  const previousFetch = globalThis.fetch;
  const previousChrome = globalThis.chrome;
  const stored = {};
  const requests = [];
  t.after(() => {
    globalThis.fetch = previousFetch;
    globalThis.chrome = previousChrome;
    pruneCache(Infinity);
  });
  pruneCache(Infinity);
  globalThis.fetch = async (url) => {
    requests.push(new URL(url));
    const body = url.includes("/me?") ? { mail: "you@outlook.com" } : {
      value: [{ id: "AAMk+/=", subject: "Exact message", receivedDateTime: new Date().toISOString(), isRead: false, webLink }],
    };
    return { ok: true, status: 200, json: async () => body };
  };
  globalThis.chrome = { storage: { local: {
    set: async (data) => Object.assign(stored, structuredClone(data)),
    get: async (key) => structuredClone({ [key]: stored[key] }),
  } } };
  const messages = await fetchOutlookMessages("fake-token");
  assert.ok(requests[1].searchParams.get("$select").split(",").includes("webLink"), "Graph must return the navigation URL");
  mergeMessages(messages);
  setLocalRead(messages[0].key);
  mergeMessages(messages);
  await persistCache();
  pruneCache(Infinity);
  const restored = await hydrateCache();
  assert.equal(threadUrl(restored[0]), webLink);
  assert.equal(getInbox()[0].localRead, true);
});

test("Outlook Open prefers exact HTTPS Outlook web origins", () => {
  for (const url of [webLink, "https://outlook.office.com/owa/?ItemID=A%2B", "https://outlook.office365.com/owa/?ItemID=A%2F"])
    assert.equal(threadUrl({ ...item, webLink: url }), url);
});

test("Outlook Open rejects unsafe or malformed provider links and supports old caches", () => {
  for (const url of [undefined, null, "", 42, {}, "not a URL", "javascript:alert(1)", "data:text/html,evil", "http://outlook.live.com/owa/", "https://evil.example/", "https://outlook.live.com.evil.example/owa/", "https://outlook.live.com@evil.example/", "https://user:pass@outlook.live.com/owa/", "https://outlook.live.com:444/owa/", "//outlook.live.com/owa/"])
    assert.equal(threadUrl({ ...item, webLink: url }), fallback, String(url));
  assert.equal(threadUrl({ key: "gmail:you%40gmail.com:abc", provider: "gmail", account: "you@gmail.com", webLink }), "https://mail.google.com/mail/?authuser=you%40gmail.com#inbox/abc");
});
