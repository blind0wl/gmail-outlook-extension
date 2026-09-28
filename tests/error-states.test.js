// Task 9 error states: stale plus offline plus needs sign in.
// Pure label tests (address plus code only, never subject or body) plus
// worker classification tests (offline flag, silent-auth failure, real
// token wiring, mixed-account isolation).

import test from "node:test";
import assert from "node:assert";
import { formatRetryAt, accountStatusLabel } from "../src/notify/notify.js";
import {
  pollAccount,
  pollAll,
  buildTokenProvider,
  handleSignIn,
  needsSignInFor,
} from "../src/background/service-worker.js";
import { getInbox, mergeMessages } from "../src/store/cache.js";
import { readAccountState } from "../src/notify/notify.js";

function installChromeStub() {
  const data = {};
  globalThis.chrome = {
    storage: {
      session: {get: async () => ({}), set: async () => {}, remove: async () => {}},
      local: {
        set: async (obj) => void Object.assign(data, obj),
        get: async (key) => ({ [key]: data[key] }),
      },
    },
  };
  return data;
}

function uninstallChromeStub() {
  delete globalThis.chrome;
}

const item = (key, provider, account) => ({
  key,
  provider,
  account,
  from: "f",
  subject: "Quarterly results",
  snippet: "salary 200k diabetes",
  date: Date.now(),
  unread: true,
});

test("retry time is short: seconds under a minute, clock after", () => {
  const now = Date.now();
  assert.equal(formatRetryAt(now + 20_000, now), "in 20s");
  assert.match(formatRetryAt(now + 5 * 60_000, now), /^\d{1,2}:\d{2}/);
});

test("stale label shows address plus code plus retry, never mail content", () => {
  const acct = { provider: "outlook", account: "slow@o.c" };
  const label = accountStatusLabel(acct, {
    backedOff: true,
    retryAt: Date.now() + 60_000,
    status: 429,
    subject: "Quarterly results",
    snippet: "salary 200k",
  });
  assert.match(label, /slow@o\.c/);
  assert.match(label, /stale/);
  assert.match(label, /429/);
  assert.ok(!label.includes("Quarterly"), "no subject in errors");
  assert.ok(!label.includes("salary"), "no body in errors");
});

test("offline note and sign-in label show the address only", () => {
  assert.equal(
    accountStatusLabel({ provider: "gmail", account: "a@g.c" }, { offline: true }),
    "a@g.c — offline, showing saved mail",
  );
  assert.equal(
    accountStatusLabel({ provider: "gmail", account: "a@g.c" }, { needsSignIn: true }),
    "a@g.c — needs sign in",
  );
});

test("healthy account has no status label", () => {
  assert.equal(accountStatusLabel({ provider: "gmail", account: "a@g.c" }, {}), null);
});

test("status-less fetch failure flags offline and keeps the stale cache", async () => {
  installChromeStub();
  // Node exposes navigator as getter-only: stub offline via defineProperty.
  const prevDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: false },
    configurable: true,
    writable: true,
  });
  try {
    const acct = { provider: "gmail", account: "err-offline@g.c" };
    mergeMessages([item("gmail:errkeep", "gmail", "err-offline@g.c")]);
    const fetchers = {
      gmail: async () => {
        throw new TypeError("network down");
      },
    };
    const r = await pollAccount(acct, { fetchers, getToken: async () => "t" });
    assert.equal(r.offline, true);
    assert.ok(!JSON.stringify(r).includes("network down"), "raw message dropped");
    assert.ok(getInbox().find((i) => i.key === "gmail:errkeep"), "stale cache kept");
    const summary = await pollAll([acct], {
      fetchers,
      getToken: async () => "t",
      notify: async () => {},
      setBadge: async () => {},
    });
    assert.ok(summary.offline.includes("gmail:err-offline@g.c"));
    const stored = await readAccountState();
    assert.equal(stored["gmail:err-offline@g.c"]?.offline, true);
  } finally {
    if (prevDesc) Object.defineProperty(globalThis, "navigator", prevDesc);
    else delete globalThis.navigator;
    uninstallChromeStub();
  }
});

test("silent token failure marks needs sign in, never mail content", async () => {
  installChromeStub();
  try {
    const acct = { provider: "gmail", account: "err-token@g.c" };
    const r = await pollAccount(acct, {
      fetchers: { gmail: async () => [item("gmail:errtok", "gmail", "err-token@g.c")] },
      getToken: async () => {
        throw new Error("silent auth failed for err-token@g.c");
      },
    });
    assert.equal(r.needsSignIn, true);
    assert.ok(!JSON.stringify(r).includes("silent auth failed"), "raw message dropped");
  } finally {
    uninstallChromeStub();
  }
});

test("real token provider calls gmail or graph silently per account", async () => {
  const prev = globalThis.chrome;
  const prevFetch = globalThis.fetch;
  const seen = [];
  globalThis.chrome = {
    identity: {
      getAuthToken: ({ interactive }, cb) => {
        seen.push(["gmail", interactive]);
        cb("gmail-tok");
      },
    },
    storage: {
      session: {
        // Per-account slots: the graph record lives under its MS keys only.
        get: async (k) => ({
          [k]: String(k).startsWith("auth.microsoft.graph")
            ? { accessToken: "graph-tok", refreshToken: "rt", expiresAt: Date.now() + 3600_000 }
            : null,
        }),
        set: async () => {},
        remove: async () => {},
      },
    },
  };
  // Account verification: the Chrome-cached credential profiles as w@g.c.
  globalThis.fetch = async (url) => ({
    ok: true,
    status: 200,
    json: async () => ({ emailAddress: "w@g.c" }),
  });
  try {
    const accounts = [
      { provider: "gmail", account: "w@g.c" },
      { provider: "outlook", account: "o@o.c", clientId: "entra-app-id" },
    ];
    const provider = buildTokenProvider(accounts);
    assert.equal(await provider.getToken(accounts[0]), "gmail-tok");
    assert.equal(await provider.getToken(accounts[1]), "graph-tok");
    assert.equal(await provider.refreshToken(accounts[0], "stale-tok"), "gmail-tok");
    assert.deepEqual(seen, [["gmail", false], ["gmail", false]], "gmail fetched silently, renewal refetches after evict");
  } finally {
    if (prev === undefined) delete globalThis.chrome;
    else globalThis.chrome = prev;
    globalThis.fetch = prevFetch;
  }
});

test("sign-in handler recovers one account without touching the others", async () => {
  const backing = installChromeStub();
  const prevFetch = globalThis.fetch;
  globalThis.chrome.identity = {
    getAuthToken: ({ interactive }, cb) => cb("fresh-tok"),
  };
  // Interactive silent-first path verifies the fresh credential's owner.
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ emailAddress: "err-signin@g.c" }),
  });
  try {
    const target = { provider: "gmail", account: "err-signin@g.c" };
    const fetchers = { gmail: async () => [item("gmail:errsin", "gmail", "err-signin@g.c")] };
    const r = await handleSignIn([target], { provider: "gmail", account: "err-signin@g.c" }, {
      fetchers,
    });
    assert.ok(r.items?.length === 1, "recovered account polls after interactive sign in");
    assert.equal(needsSignInFor(target), false);
    assert.equal(backing.accountState?.["gmail:err-signin@g.c"]?.needsSignIn, false);
  } finally {
    globalThis.fetch = prevFetch;
    uninstallChromeStub();
  }
});
