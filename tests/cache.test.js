import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeMessages,
  setLocalRead,
  pruneCache,
  getInbox,
  reconcileAccount,
} from "../src/store/cache.js";
const acct = { provider: "gmail", account: "work@gmail.com" };
const row = (id, date) => ({
  key: `gmail:work%40gmail.com:${id}`,
  ...acct,
  date,
  unread: true,
  subject: "subject",
  snippet: "snippet",
});

test("local read survives a complete account snapshot", () => {
  pruneCache(Infinity);
  const item = row("1", Date.now());
  mergeMessages([item]);
  setLocalRead(item.key);
  reconcileAccount(acct, [item], true);
  assert.equal(getInbox()[0].localRead, true);
});

test("partial empty snapshot preserves cached items", () => {
  pruneCache(Infinity);
  const item = row("partial", Date.now());
  mergeMessages([item]);
  reconcileAccount(acct, [], false);
  assert.equal(getInbox()[0].key, item.key);
});

test("complete empty snapshot removes only that account", () => {
  pruneCache(Infinity);
  mergeMessages([
    row("removed", Date.now()),
    {
      ...row("other", Date.now()),
      key: "gmail:other%40gmail.com:other",
      account: "other@gmail.com",
    },
  ]);
  reconcileAccount(acct, [], true);
  assert.deepEqual(
    getInbox().map((i) => i.account),
    ["other@gmail.com"],
  );
});

test("cache caps at 200 newest items", () => {
  pruneCache(Infinity);
  const now = Date.now();
  mergeMessages(Array.from({ length: 201 }, (_, i) => row(String(i), now + i)));
  assert.equal(getInbox().length, 200);
  assert.equal(
    getInbox().some((i) => i.key === "gmail:work%40gmail.com:0"),
    false,
  );
});

test("cache orders messages newest first regardless of merge order", () => {
  pruneCache(Infinity);
  const now = Date.now();
  mergeMessages([
    row("middle", now - 1),
    row("oldest", now - 2),
    row("newest", now),
  ]);
  assert.deepEqual(
    getInbox().map((i) => i.key),
    [
      "gmail:work%40gmail.com:newest",
      "gmail:work%40gmail.com:middle",
      "gmail:work%40gmail.com:oldest",
    ],
  );
});

test("exact seven-day expiry boundary is retained, one millisecond beyond is removed", () => {
  pruneCache(Infinity);
  const now = Date.now();
  mergeMessages([row("boundary", now)]);
  assert.equal(pruneCache(now + 7 * 86400000).length, 1);
  assert.equal(pruneCache(now + 7 * 86400000 + 1).length, 0);
});
