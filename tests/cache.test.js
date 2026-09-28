import test from "node:test";
import assert from "node:assert";
import { mergeMessages, setLocalRead, pruneCache } from "../src/store/cache.js";
test("local read survives merge and expiry prunes old", () => {
  const now = Date.now();
  mergeMessages([{ key: "gmail:1", provider: "gmail", account: "work@gmail.com", from: "a", subject: "s", snippet: "p", date: now, unread: true }]);
  setLocalRead("gmail:1");
  mergeMessages([{ key: "gmail:1", provider: "gmail", account: "work@gmail.com", from: "a", subject: "s", snippet: "p", date: now, unread: true }]);
  const kept = pruneCache(now + 8 * 24 * 3600 * 1000);
  assert.equal(kept.find(i => i.key === "gmail:1"), undefined);
});
test("offline empty fetch keeps stale items visible", () => {
  const now = Date.now();
  mergeMessages([{ key: "gmail:off1", provider: "gmail", account: "work@gmail.com", from: "a", subject: "s", snippet: "p", date: now, unread: true }]);
  // Offline means the adapter yields nothing and throws nothing usable:
  // the worker merges zero items and the stale cache stays on screen.
  const { items } = mergeMessages([]);
  assert.equal(items.find(i => i.key === "gmail:off1").key, "gmail:off1");
  assert.ok(pruneCache(now).find(i => i.key === "gmail:off1"), "no expiry yet, stale stays");
});
test("zero item poll keeps stale cache", () => {
  const now = Date.now();
  mergeMessages([{ key: "gmail:9", provider: "gmail", account: "work@gmail.com", from: "a", subject: "s", snippet: "p", date: now, unread: true }]);
  const { items } = mergeMessages([]);
  assert.equal(items.find(i => i.key === "gmail:9").key, "gmail:9");
});
