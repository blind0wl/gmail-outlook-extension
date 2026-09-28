// Accounts helper contract (Task 9). Account records live under the
// "accounts" key in chrome.storage.local with provider plus address plus
// toggles; this module is the single place that knows the key and shape.

import test from "node:test";
import assert from "node:assert";
import {
  ACCOUNTS_KEY,
  normalizeAccount,
  accountKey,
  accountAddress,
  getMicrosoftClientId,
  loadAccounts,
} from "../src/store/accounts.js";

test("accounts key is the shared storage key", () => {
  assert.equal(ACCOUNTS_KEY, "accounts");
});

test("normalize keeps provider plus address with toggles defaulting on", () => {
  const out = normalizeAccount({ provider: "gmail", account: "work@gmail.com" });
  assert.equal(out.provider, "gmail");
  assert.equal(out.account, "work@gmail.com");
  assert.equal(out.enabled, true);
});

test("normalize accepts address alias and explicit toggles", () => {
  const out = normalizeAccount({
    provider: "outlook",
    address: "you@outlook.com",
    enabled: false,
    notify: false,
    clientId: "entra-app-id",
  });
  assert.equal(out.account, "you@outlook.com");
  assert.equal(out.enabled, false);
  assert.equal(out.notify, false);
  assert.equal(out.clientId, "entra-app-id");
});

test("accountKey and accountAddress expose key plus address only", () => {
  const acct = normalizeAccount({ provider: "gmail", account: "a@g.c" });
  assert.equal(accountKey(acct), "gmail:a@g.c");
  assert.equal(accountAddress(acct), "a@g.c");
});

test("microsoft client id comes from the first outlook record", () => {
  const accounts = [
    normalizeAccount({ provider: "gmail", account: "a@g.c" }),
    normalizeAccount({ provider: "outlook", account: "b@o.c", clientId: "entra-1" }),
  ];
  assert.equal(getMicrosoftClientId(accounts), "entra-1");
  assert.equal(getMicrosoftClientId([{ provider: "gmail", account: "a@g.c" }]), null);
});

test("loadAccounts is empty without chrome", async () => {
  const prev = globalThis.chrome;
  delete globalThis.chrome;
  try {
    assert.deepEqual(await loadAccounts(), []);
  } finally {
    if (prev !== undefined) globalThis.chrome = prev;
  }
});
