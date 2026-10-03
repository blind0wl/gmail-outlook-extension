// Sign-out races and explicit sign-out failures. No live OAuth; chrome
// and fetch are stubbed with delayed responses to force overlap.

import test from "node:test";
import assert from "node:assert";
import {
  configureMicrosoftAuth,
  getGraphToken,
  clearGraphToken,
  readSessionRecord,
  MS_SESSION_KEY,
} from "../src/auth/microsoft.js";
import { handleMessage, handleSignIn } from "../src/background/service-worker.js";
import { loadAccounts, saveAccounts } from "../src/store/accounts.js";
import { getInbox } from "../src/store/cache.js";
import { hydrateCache, readAccountState } from "../src/notify/notify.js";

configureMicrosoftAuth({ clientId: "test-client-id" });

function memorySession(seed = {}) {
  const data = { ...seed };
  return {
    data,
    async get(k) {
      return { [k]: data[k] ?? null };
    },
    async set(obj) {
      Object.assign(data, obj);
    },
    async remove(k) {
      delete data[k];
    },
  };
}

function expiredRecord() {
  return {
    accessToken: "old-token",
    refreshToken: "old-refresh",
    expiresAt: Date.now() - 1000,
  };
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function memoryLocal(seed = {}) {
  return {
    data: structuredClone(seed),
    async get(key) {
      if (key == null) return structuredClone(this.data);
      return { [key]: structuredClone(this.data[key]) };
    },
    async set(values) {
      Object.assign(this.data, structuredClone(values));
    },
    async remove(key) {
      delete this.data[key];
    },
  };
}

function memoryChrome(local = memoryLocal()) {
  return {
    storage: {
      local,
      session: memorySession(),
    },
  };
}

test("late refresh cannot restore a cleared session", async () => {
  const prevChrome = globalThis.chrome;
  const prevFetch = globalThis.fetch;
  const session = memorySession({ [MS_SESSION_KEY]: expiredRecord() });
  globalThis.chrome = { storage: { session } };
  globalThis.fetch = async () => {
    await delay(30);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "late-token",
        refresh_token: "late-rt",
        expires_in: 3600,
      }),
    };
  };
  try {
    const pending = getGraphToken(false);
    await clearGraphToken();
    await assert.rejects(pending, /needs sign in|superseded by sign out/);
    assert.equal(await readSessionRecord(), null);
  } finally {
    globalThis.chrome = prevChrome;
    globalThis.fetch = prevFetch;
  }
});

test("late interactive sign-in cannot restore a cleared session", async () => {
  const prevChrome = globalThis.chrome;
  const prevFetch = globalThis.fetch;
  const session = memorySession();
  globalThis.chrome = {
    identity: {
      getRedirectURL: () => "https://testid.chromiumapp.org/",
      launchWebAuthFlow: ({ url }, cb) => {
        const state = new URL(url).searchParams.get("state");
        setTimeout(
          () => cb(`https://testid.chromiumapp.org/?code=c&state=${state}`),
          30,
        );
      },
    },
    storage: { session },
  };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      access_token: "late-token",
      refresh_token: "late-rt",
      expires_in: 3600,
    }),
  });
  try {
    const pending = getGraphToken(true);
    await clearGraphToken();
    await assert.rejects(pending, /superseded by sign out/);
    assert.equal(await readSessionRecord(), null);
  } finally {
    globalThis.chrome = prevChrome;
    globalThis.fetch = prevFetch;
  }
});

test("sign out during paused recovery authentication prevents polling and stale state", async () => {
  const prevChrome = globalThis.chrome;
  const paused = { provider: "gmail", account: "auth-race@gmail.com", enabled: false, notify: false };
  const other = { provider: "gmail", account: "auth-race-other@gmail.com", enabled: true, notify: true };
  const local = memoryLocal({ accounts: [paused, other] });
  globalThis.chrome = memoryChrome(local);
  let releaseAuth;
  let authStartedResolve;
  const authStarted = new Promise((resolve) => { authStartedResolve = resolve; });
  const authGate = new Promise((resolve) => { releaseAuth = resolve; });
  let fetchCount = 0;
  try {
    const recovery = handleSignIn([paused, other], paused, {
      interactiveGet: async () => {
        authStartedResolve();
        return authGate;
      },
      fetchers: { gmail: async () => { fetchCount += 1; return []; } },
      setBadge: async () => {},
    });
    await authStarted;
    const signedOut = await handleMessage({
      type: "sign-out",
      provider: paused.provider,
      account: paused.account,
    }, { setBadge: async () => {} });
    assert.equal(signedOut.ok, true);
    releaseAuth(null);
    const result = await recovery;
    assert.equal(result.needsSignIn, true);
    assert.equal(fetchCount, 0);
    assert.deepEqual(await loadAccounts(), [paused, other]);
    const state = await readAccountState();
    assert.equal(state["gmail:auth-race@gmail.com"]?.signedOut, true);
    assert.deepEqual(state["gmail:auth-race-other@gmail.com"], undefined);
  } finally {
    globalThis.chrome = prevChrome;
  }
});

test("remove during paused recovery authentication does not recreate the account", async () => {
  const prevChrome = globalThis.chrome;
  const paused = { provider: "gmail", account: "auth-remove-race@gmail.com", enabled: false, notify: false };
  const other = { provider: "gmail", account: "auth-remove-other@gmail.com", enabled: true, notify: true };
  const local = memoryLocal({ accounts: [paused, other] });
  globalThis.chrome = memoryChrome(local);
  let releaseAuth;
  let authStartedResolve;
  const authStarted = new Promise((resolve) => { authStartedResolve = resolve; });
  const authGate = new Promise((resolve) => { releaseAuth = resolve; });
  let fetchCount = 0;
  try {
    const recovery = handleSignIn([paused, other], paused, {
      interactiveGet: async () => {
        authStartedResolve();
        return authGate;
      },
      fetchers: { gmail: async () => { fetchCount += 1; return []; } },
      setBadge: async () => {},
    });
    await authStarted;
    const removed = await handleMessage({
      type: "remove-account",
      provider: paused.provider,
      account: paused.account,
    }, { setBadge: async () => {} });
    assert.equal(removed.ok, true);
    releaseAuth(null);
    const result = await recovery;
    assert.equal(result.needsSignIn, true);
    assert.equal(fetchCount, 0);
    assert.deepEqual(await loadAccounts(), [other]);
    assert.equal(local.data.accountState?.["gmail:auth-remove-race@gmail.com"], undefined);
  } finally {
    globalThis.chrome = prevChrome;
  }
});

test("sign out during paused recovery fetch prevents cache and state commits", async () => {
  const prevChrome = globalThis.chrome;
  const paused = { provider: "gmail", account: "fetch-signout-race@gmail.com", enabled: false, notify: false };
  const local = memoryLocal({ accounts: [paused] });
  globalThis.chrome = memoryChrome(local);
  let releaseFetch;
  let fetchStartedResolve;
  const fetchStarted = new Promise((resolve) => { fetchStartedResolve = resolve; });
  const fetchGate = new Promise((resolve) => { releaseFetch = resolve; });
  const recoveredItem = {
    key: `gmail:${encodeURIComponent(paused.account)}:late`,
    provider: "gmail",
    account: paused.account,
    from: "sender",
    subject: "late",
    snippet: "late",
    date: Date.now(),
    unread: true,
  };
  try {
    const recovery = handleSignIn([paused], paused, {
      interactiveGet: async () => null,
      fetchers: {
        gmail: async () => {
          fetchStartedResolve();
          await fetchGate;
          return [recoveredItem];
        },
      },
      setBadge: async () => {},
    });
    await fetchStarted;
    const signedOut = await handleMessage({
      type: "sign-out",
      provider: paused.provider,
      account: paused.account,
    }, { setBadge: async () => {} });
    assert.equal(signedOut.ok, true);
    releaseFetch();
    const result = await recovery;
    assert.equal(result.needsSignIn, true);
    assert.deepEqual(await loadAccounts(), [paused]);
    assert.ok(!local.data.mailCache?.some((item) => item.account === paused.account));
    assert.equal(getInbox().some((item) => item.key === recoveredItem.key), false);
    const state = await readAccountState();
    assert.equal(state["gmail:fetch-signout-race@gmail.com"]?.signedOut, true);
  } finally {
    globalThis.chrome = prevChrome;
  }
});

test("remove during paused recovery fetch cannot restore mail or overwrite another account", async () => {
  const prevChrome = globalThis.chrome;
  const paused = { provider: "gmail", account: "fetch-race@gmail.com", enabled: false, notify: false };
  const other = { provider: "gmail", account: "fetch-race-other@gmail.com", enabled: true, notify: true };
  const updatedOther = { ...other, notify: false };
  const existing = {
    key: `gmail:${encodeURIComponent(paused.account)}:existing`,
    provider: "gmail",
    account: paused.account,
    from: "sender",
    subject: "existing",
    snippet: "existing",
    date: Date.now(),
    unread: true,
  };
  const local = memoryLocal({
    accounts: [paused, other],
    mailCache: [existing],
    accountState: { "gmail:fetch-race@gmail.com": { needsSignIn: true } },
  });
  globalThis.chrome = memoryChrome(local);
  await hydrateCache();
  let releaseFetch;
  let fetchStartedResolve;
  const fetchStarted = new Promise((resolve) => { fetchStartedResolve = resolve; });
  const fetchGate = new Promise((resolve) => { releaseFetch = resolve; });
  const recoveredItem = {
    ...existing,
    key: `gmail:${encodeURIComponent(paused.account)}:recovered`,
    subject: "recovered",
  };
  try {
    const recovery = handleSignIn([paused, other], paused, {
      interactiveGet: async () => null,
      fetchers: {
        gmail: async () => {
          fetchStartedResolve();
          await fetchGate;
          return [recoveredItem];
        },
      },
      setBadge: async () => {},
    });
    const started = await Promise.race([fetchStarted, delay(50).then(() => false)]);
    assert.notEqual(started, false, "paused recovery starts the provider fetch");

    await saveAccounts([paused, updatedOther]);
    const removed = await handleMessage({
      type: "remove-account",
      provider: paused.provider,
      account: paused.account,
    }, { setBadge: async () => {} });
    assert.equal(removed.ok, true);
    releaseFetch();
    await recovery;

    assert.deepEqual(await loadAccounts(), [updatedOther]);
    assert.equal(getInbox().some((item) => item.account === paused.account), false);
    assert.equal(local.data.mailCache.some((item) => item.account === paused.account), false);
    assert.equal(local.data.accountState["gmail:fetch-race@gmail.com"], undefined);
  } finally {
    globalThis.chrome = prevChrome;
  }
});

test("clearGraphToken reports storage removal failure", async () => {
  const prev = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      session: {
        async remove() {
          throw new Error("disk gone");
        },
      },
    },
  };
  try {
    await assert.rejects(() => clearGraphToken(), /microsoft sign out failed/);
  } finally {
    globalThis.chrome = prev;
  }
});

test("clearGraphToken reports a missing session store", async () => {
  const prev = globalThis.chrome;
  globalThis.chrome = undefined;
  try {
    await assert.rejects(() => clearGraphToken(), /storage\.session missing/);
  } finally {
    globalThis.chrome = prev;
  }
});

test("clearGraphToken resolves true and empties the session", async () => {
  const prev = globalThis.chrome;
  const session = memorySession({ [MS_SESSION_KEY]: expiredRecord() });
  globalThis.chrome = { storage: { session } };
  try {
    assert.equal(await clearGraphToken(), true);
    assert.equal(await readSessionRecord(), null);
  } finally {
    globalThis.chrome = prev;
  }
});
