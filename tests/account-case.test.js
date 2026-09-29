// Issue #3: case-insensitive account resolution in lifecycle controls.
// A mixed-case stored address must still resolve Sign in/out/Remove and
// duplicate detection, and provider ingestion must normalize the address
// case so cache identity, state keys, and popup lookups agree.

import test from "node:test";
import assert from "node:assert/strict";
import * as cache from "../src/store/cache.js";
import * as worker from "../src/background/service-worker.js";
import {
  normalizeAccount,
  accountKey,
} from "../src/store/accounts.js";
import { normalizeGmailMessage } from "../src/providers/gmail.js";
import { normalizeGraphMessage } from "../src/providers/outlook.js";
import raw from "../tests/fixtures/graph-list.json" with { type: "json" };

const MIXED = "Work@Gmail.com";
const LOWER = "work@gmail.com";

function store(seed = {}) {
  return {
    data: structuredClone(seed),
    async get(k) {
      return k === null
        ? structuredClone(this.data)
        : { [k]: structuredClone(this.data[k]) };
    },
    async set(v) {
      Object.assign(this.data, structuredClone(v));
    },
    async remove(k) {
      delete this.data[k];
    },
  };
}

function setupMixedCase() {
  cache.pruneCache(Infinity);
  const local = store({
    accounts: [
      { provider: "gmail", account: MIXED, enabled: true, notify: true },
    ],
  });
  globalThis.chrome = { storage: { local } };
  return local;
}

const badgeDeps = { setBadge: async () => {} };

test("normalizeAccount lowercases the stored address", () => {
  const out = normalizeAccount({ provider: "gmail", account: "  Work@Gmail.com " });
  assert.equal(out.account, "work@gmail.com");
});

test("accountKey agrees across address case", () => {
  assert.equal(
    accountKey({ provider: "gmail", account: MIXED }),
    accountKey({ provider: "gmail", account: LOWER }),
  );
  assert.equal(accountKey({ provider: "gmail", account: MIXED }), "gmail:work@gmail.com");
});

test("gmail ingestion normalizes provider-reported case", () => {
  const out = normalizeGmailMessage({ id: "abc123" }, MIXED);
  assert.equal(out.account, LOWER);
  assert.equal(out.key, "gmail:work%40gmail.com:abc123");
});

test("outlook ingestion normalizes provider-reported case", () => {
  const out = normalizeGraphMessage(raw.value[0], "You@Outlook.com");
  assert.equal(out.account, "you@outlook.com");
  assert.equal(out.key, `outlook:you%40outlook.com:${raw.value[0].id}`);
});

test("sign-out resolves a mixed-case stored account", async () => {
  const local = setupMixedCase();
  const res = await worker.handleMessage(
    { type: "sign-out", provider: "gmail", account: LOWER },
    badgeDeps,
  );
  assert.equal(res.ok, true);
  assert.equal(local.data.accounts.length, 1);
});

test("add-account detects a duplicate across address case", async () => {
  setupMixedCase();
  await assert.rejects(
    worker.handleMessage(
      { type: "add-account", provider: "gmail", account: "WORK@GMAIL.COM" },
      badgeDeps,
    ),
    /account already exists/,
  );
});

test("remove-account resolves a mixed-case stored account", async () => {
  const local = setupMixedCase();
  const res = await worker.handleMessage(
    { type: "remove-account", provider: "gmail", account: "Work@Gmail.Com" },
    badgeDeps,
  );
  assert.equal(res.ok, true);
  assert.equal(local.data.accounts.length, 0);
});
