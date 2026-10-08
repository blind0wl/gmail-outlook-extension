import test from "node:test";
import assert from "node:assert/strict";
import {
  addDemoEmails,
  AUTH_CODE_DEMO_INBOX_KEY,
  clearDemoInbox,
  createDemoEmail,
  getDemoInbox,
} from "../src/auth-codes/demo.js";
import { detectAuthCode } from "../src/auth-codes/detector.js";

function localStorageDouble(initial = {}) {
  const values = { ...initial };
  return {
    values,
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((key) => key in values).map((key) => [key, values[key]]));
    },
    async set(patch) { Object.assign(values, patch); },
  };
}

test("demo scenarios create fresh plausible codes, including guaranteed mixed alphanumeric values", () => {
  const now = 1_800_000_000_000;
  const email = createDemoEmail("numeric", { now, id: "numeric-1" });
  const result = detectAuthCode(email, { now });
  assert.equal(result.status, "code");
  assert.equal(email.provider, "demo");
  assert.equal(email.account, "local-demo");
  assert.match(email.key, /^demo:local-demo:/);
  assert.match(email.snippet, new RegExp(result.code));

  const alpha = createDemoEmail("alphanumeric", { now, id: "alpha-1" });
  const alphaResult = detectAuthCode(alpha, { now });
  assert.equal(alphaResult.status, "code");
  assert.match(alphaResult.code, /[A-Z]/);
  assert.match(alphaResult.code, /\d/);

  const ambiguous = createDemoEmail("ambiguous", { now, id: "ambiguous-1" });
  assert.equal(detectAuthCode(ambiguous, { now }).status, "ambiguous");
});

test("demo inbox uses a separate local key and never changes real cache or accounts", async () => {
  const local = localStorageDouble({
    mailCache: [{ key: "gmail:real:existing" }],
    accounts: [{ provider: "gmail", account: "real@example.com" }],
  });
  const prior = globalThis.chrome;
  globalThis.chrome = { storage: { local } };
  try {
    const email = createDemoEmail("numeric", { now: Date.now(), id: "local-only" });
    await addDemoEmails([email]);
    assert.equal((await getDemoInbox()).length, 1);
    assert.equal(local.values[AUTH_CODE_DEMO_INBOX_KEY][0].key, email.key);
    assert.equal(local.values.mailCache[0].key, "gmail:real:existing");
    assert.equal(local.values.accounts[0].account, "real@example.com");
    await clearDemoInbox();
    assert.deepEqual(local.values[AUTH_CODE_DEMO_INBOX_KEY], []);
    assert.equal(local.values.mailCache[0].key, "gmail:real:existing");
    assert.equal(local.values.accounts[0].account, "real@example.com");
  } finally {
    globalThis.chrome = prior;
  }
});
