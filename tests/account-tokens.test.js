// Fix round 1: per-account token identity, MS configure ordering, forced
// renewal, token-error classes, stale marker. Chrome identity and network
// are stubbed; no live OAuth, no tokens leave the process.

import test from "node:test";
import assert from "node:assert";
import {
  configureMicrosoftAuth,
  getConfiguredClientId,
  getGraphTokenForAccount,
  renewGraphToken,
  clearGraphToken,
  readSessionRecord,
  sessionKeyFor,
  MS_SESSION_KEY,
} from "../src/auth/microsoft.js";
import {
  pollAccount,
  pollAll,
  buildTokenProvider,
  handleSignIn,
  needsSignInFor,
} from "../src/background/service-worker.js";
import { fetchGmailMessages } from "../src/providers/gmail.js";
import { getInbox, mergeMessages } from "../src/store/cache.js";
import { loadAccounts, saveAccounts } from "../src/store/accounts.js";
import { accountStatusLabel, readAccountState } from "../src/notify/notify.js";

const MS_TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

function memoryStores(seedLocal = {}, seedSession = {}) {
  const local = { ...seedLocal };
  const session = { ...seedSession };
  return {
    local,
    session,
    chrome: {
      storage: {
        local: {
          set: async (obj) => void Object.assign(local, obj),
          get: async (key) => ({ [key]: local[key] }),
        },
        session: {
          // get(null) enumerates the whole area, mirroring chrome.storage.
          get: async (k) => (k == null ? { ...session } : { [k]: session[k] ?? null }),
          set: async (obj) => void Object.assign(session, obj),
          remove: async (k) => void delete session[k],
        },
      },
    },
  };
}

function installChrome(chrome) {
  const prev = globalThis.chrome;
  globalThis.chrome = chrome;
  return prev;
}

function restoreChrome(prev) {
  if (prev === undefined) delete globalThis.chrome;
  else globalThis.chrome = prev;
}

function stubFetch(router) {
  const prev = globalThis.fetch;
  globalThis.fetch = router;
  return prev;
}

function stubNavigator(onLine) {
  const prevDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine },
    configurable: true,
    writable: true,
  });
  return prevDesc;
}

function restoreNavigator(prevDesc) {
  if (prevDesc) Object.defineProperty(globalThis, "navigator", prevDesc);
  else delete globalThis.navigator;
}

const err401 = () => {
  const e = new Error("unauthorized");
  e.status = 401;
  return e;
};

const item = (key, provider, account) => ({
  key,
  provider,
  account,
  from: "f",
  subject: "s",
  snippet: "p",
  date: Date.now(),
  unread: true,
});

// Feed transport: Gmail needs no credentials. Two records poll with null
// tokens through the real provider and each account keeps its own mail.
test("two gmail accounts poll credential-free with per-account mail", async () => {
  const { chrome } = memoryStores();
  const prev = installChrome(chrome);
  try {
    const a = { provider: "gmail", account: "t1-a@gmail.com" };
    const b = { provider: "gmail", account: "t1-b@gmail.com" };
    const provider = buildTokenProvider([a, b]);
    const seenTokens = [];
    const fetchers = {
      gmail: async (token, _since, account) => {
        seenTokens.push(token);
        return [item(`gmail:t1-${account}`, "gmail", account)];
      },
    };
    const summary = await pollAll([a, b], {
      fetchers,
      getToken: provider.getToken,
      refreshToken: provider.refreshToken,
      notify: async () => {},
      setBadge: async () => {},
    });
    assert.ok(summary.succeeded.includes("gmail:t1-a@gmail.com"));
    assert.ok(summary.succeeded.includes("gmail:t1-b@gmail.com"));
    assert.ok(seenTokens.every((t) => t === null), "no credential sent");
    assert.ok(getInbox().find((i) => i.key === "gmail:t1-t1-a@gmail.com"));
    assert.ok(getInbox().find((i) => i.key === "gmail:t1-t1-b@gmail.com"));
  } finally {
    restoreChrome(prev);
  }
});

// Fix 1 (microsoft): each outlook record owns a separate session slot.
test("outlook accounts resolve credentials from separate slots", async () => {
  const keyA = sessionKeyFor("t1c-a@o.c");
  const keyB = sessionKeyFor("t1c-b@o.c");
  const stores = memoryStores({}, {
    [keyA]: { accessToken: "tok-A", refreshToken: "rt-A", expiresAt: Date.now() + 3600_000 },
    [keyB]: { accessToken: "tok-B", refreshToken: "rt-B", expiresAt: Date.now() + 3600_000 },
  });
  const prev = installChrome(stores.chrome);
  try {
    configureMicrosoftAuth({ clientId: "entra-slots-1" });
    assert.equal(await getGraphTokenForAccount("t1c-a@o.c", false), "tok-A");
    assert.equal(await getGraphTokenForAccount("t1c-b@o.c", false), "tok-B");
  } finally {
    restoreChrome(prev);
  }
});

// Fix 2: sign-in as the first worker event configures Microsoft before
// authenticating (fresh client id, no prior buildTokenProvider call).
test("microsoft sign-in configures before authenticating on a fresh worker", async () => {
  const stores = memoryStores();
  let capturedUrl = null;
  const prev = installChrome({
    ...stores.chrome,
    runtime: {},
    identity: {
      getRedirectURL: () => "https://testid.chromiumapp.org/",
      launchWebAuthFlow: ({ url }, cb) => {
        capturedUrl = url;
        const state = new URL(url).searchParams.get("state");
        cb(`https://testid.chromiumapp.org/?code=c&state=${state}`);
      },
    },
  });
  const prevFetch = stubFetch(async (url) => {
    if (String(url).startsWith("https://graph.microsoft.com/v1.0/me")) {
      return { ok: true, status: 200, json: async () => ({ mail: "t2@o.c" }) };
    }
    assert.equal(String(url), MS_TOKEN_URL);
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "ms-tok", refresh_token: "ms-rt", expires_in: 3600 }),
    };
  });
  try {
    const acct = { provider: "outlook", account: "t2@o.c", clientId: "entra-first-2" };
    const r = await handleSignIn([acct], { provider: "outlook", account: "t2@o.c" }, {
      fetchers: {
        outlook: async (token) => {
          assert.equal(token, "ms-tok");
          return [item("outlook:t2msg", "outlook", "t2@o.c")];
        },
      },
    });
    assert.equal(r.items?.length, 1);
    assert.equal(getConfiguredClientId(), "entra-first-2");
    assert.match(capturedUrl, /login_hint=t2%40o\.c/);
    assert.equal(stores.local.accountState?.["outlook:t2@o.c"]?.needsSignIn, false);
    assert.equal(needsSignInFor(acct), false);
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

// Fix 3 (microsoft): a rejected but locally unexpired token is force-renewed.
test("rejected unexpired microsoft token is force-renewed, never reused", async () => {
  const key = sessionKeyFor("t3@o.c");
  const stores = memoryStores({}, {
    [key]: {
      accessToken: "bad-tok",
      refreshToken: "rt-3",
      expiresAt: Date.now() + 3600_000,
      account: "t3@o.c",
    },
  });
  const prev = installChrome(stores.chrome);
  const prevFetch = stubFetch(async (url) => {
    if (String(url).startsWith("https://graph.microsoft.com/v1.0/me")) {
      return { ok: true, status: 200, json: async () => ({ mail: "t3@o.c" }) };
    }
    assert.equal(String(url), MS_TOKEN_URL);
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "new-tok", expires_in: 3600 }),
    };
  });
  try {
    const accounts = [{ provider: "outlook", account: "t3@o.c", clientId: "entra-renew-3" }];
    const provider = buildTokenProvider(accounts);
    // Silent path still serves the cached (rejected) credential...
    assert.equal(await provider.getToken(accounts[0]), "bad-tok");
    const fetchers = {
      outlook: async (token) => {
        if (token === "bad-tok") throw err401();
        if (token === "new-tok") return [item("outlook:t3msg", "outlook", "t3@o.c")];
        const e = new Error("foreign token");
        e.status = 403;
        throw e;
      },
    };
    const r = await pollAccount(accounts[0], {
      fetchers,
      getToken: provider.getToken,
      refreshToken: provider.refreshToken,
    });
    assert.equal(r.items?.length, 1);
    assert.equal(r.refreshed, true);
    assert.equal(stores.session[key]?.accessToken, "new-tok");
    assert.equal(stores.session[key]?.refreshToken, "rt-3", "old refresh preserved");
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

// Fix 3 (microsoft): a dead grant evicts the slot and drives sign-in recovery.
test("dead microsoft grant evicts the slot and marks needs sign in", async () => {
  const key = sessionKeyFor("t3b@o.c");
  const stores = memoryStores({}, {
    [key]: {
      accessToken: "bad-tok",
      refreshToken: "dead-rt",
      expiresAt: Date.now() + 3600_000,
      account: "t3b@o.c",
    },
  });
  const prev = installChrome(stores.chrome);
  const prevFetch = stubFetch(async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: "invalid_grant" }),
  }));
  try {
    await assert.rejects(
      renewGraphToken("t3b@o.c", "bad-tok", { clientId: "entra-dead-3" }),
      /needs sign in/,
    );
    assert.equal(stores.session[key] ?? null, null, "dead slot evicted");
    const r = await pollAccount(
      { provider: "outlook", account: "t3b@o.c" },
      {
        fetchers: { outlook: async () => { throw err401(); } },
        getToken: async () => "bad-tok",
        refreshToken: async (acct, rejected) => renewGraphToken(acct.account, rejected, { clientId: "entra-dead-3" }),
      },
    );
    assert.equal(r.needsSignIn, true);
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

// Feed transport keeps nothing to renew: the real provider resolves null
// for Gmail on both callback paths, so nothing is evicted or refreshed.
test("gmail token callbacks resolve null through the real provider", async () => {
  const { chrome } = memoryStores();
  const prev = installChrome(chrome);
  try {
    const provider = buildTokenProvider([{ provider: "gmail", account: "t7@gmail.com" }]);
    assert.equal(await provider.getToken({ provider: "gmail", account: "t7@gmail.com" }), null);
    assert.equal(await provider.refreshToken({ provider: "gmail", account: "t7@gmail.com" }, "old-g"), null);
  } finally {
    restoreChrome(prev);
  }
});

// Fix 4: acquisition failure while offline stays offline (flags preserved,
// never needs-sign-in).
test("token acquisition failure while offline preserves offline state", async () => {
  const { chrome } = memoryStores();
  const prev = installChrome(chrome);
  const prevNav = stubNavigator(false);
  try {
    const acct = { provider: "gmail", account: "t8@gmail.com" };
    const r = await pollAccount(acct, {
      fetchers: { gmail: async () => [item("gmail:t8msg", "gmail", "t8@gmail.com")] },
      getToken: async () => { throw new Error("dns boom"); },
    });
    assert.equal(r.offline, true);
    assert.equal(r.needsSignIn, undefined);
    const summary = await pollAll([acct], {
      fetchers: { gmail: async () => { throw new Error("dns boom"); } },
      getToken: async () => { throw new Error("dns boom"); },
      notify: async () => {},
      setBadge: async () => {},
    });
    assert.ok(summary.offline.includes("gmail:t8@gmail.com"));
    const stored = await readAccountState();
    assert.equal(stored["gmail:t8@gmail.com"]?.offline, true);
    assert.ok(!stored["gmail:t8@gmail.com"]?.needsSignIn, "no sign-in flag from an offline blip");
  } finally {
    restoreNavigator(prevNav);
    restoreChrome(prev);
  }
});

// Fix 4: transient acquisition/renewal failures stay generic errors.
test("transient token failures are generic, never needs sign in", async () => {
  const { chrome } = memoryStores();
  const prev = installChrome(chrome);
  try {
    const blip = () => {
      const e = new Error("socket reset");
      e.transient = true;
      throw e;
    };
    const r = await pollAccount(
      { provider: "gmail", account: "t9@gmail.com" },
      { fetchers: { gmail: async () => [] }, getToken: async () => blip() },
    );
    assert.ok(r.error, "generic error recorded");
    assert.equal(r.needsSignIn, undefined);
    assert.equal(r.offline, undefined);
    const r2 = await pollAccount(
      { provider: "gmail", account: "t9b@gmail.com" },
      {
        fetchers: { gmail: async () => { throw err401(); } },
        getToken: async () => "tok",
        refreshToken: async () => blip(),
      },
    );
    assert.ok(r2.error, "renewal blip recorded");
    assert.equal(r2.needsSignIn, undefined, "no interactive recovery for a blip");
  } finally {
    restoreChrome(prev);
  }
});

// Fix 5: online status-less failures persist a sanitized stale marker that
// the popup renders without raw error text.
test("online network failure persists a stale marker the label renders", async () => {
  const { chrome } = memoryStores();
  const prev = installChrome(chrome);
  try {
    const acct = { provider: "gmail", account: "t10@gmail.com" };
    mergeMessages([item("gmail:t10keep", "gmail", "t10@gmail.com")]);
    const fetchers = {
      gmail: async () => { throw new TypeError("socket reset by peer"); },
    };
    await pollAll([acct], {
      fetchers,
      getToken: async () => "t",
      notify: async () => {},
      setBadge: async () => {},
    });
    const stored = await readAccountState();
    const entry = stored["gmail:t10@gmail.com"];
    assert.equal(entry?.stale, true);
    assert.ok(!entry?.offline, "online failure is not offline");
    assert.ok(getInbox().find((i) => i.key === "gmail:t10keep"), "stale cache kept");
    const label = accountStatusLabel(acct, entry);
    assert.ok(label?.includes("t10@gmail.com"), "address shown");
    assert.ok(!label.includes("socket reset"), "no raw error text");
    assert.match(label, /stale/);
  } finally {
    restoreChrome(prev);
  }
});

test("stale marker label shows address only", () => {
  assert.equal(
    accountStatusLabel({ provider: "outlook", account: "s@o.c" }, { stale: true }),
    "s@o.c — stale, showing saved mail",
  );
});

// Fix round 2.1 (microsoft): a foreign identity completing the flow is
// rejected and never stored under the requested address.
test("microsoft sign-in rejects a foreign identity", async () => {
  const stores = memoryStores();
  let capturedUrl = null;
  const prev = installChrome({
    ...stores.chrome,
    runtime: {},
    identity: {
      getRedirectURL: () => "https://testid.chromiumapp.org/",
      launchWebAuthFlow: ({ url }, cb) => {
        capturedUrl = url;
        const state = new URL(url).searchParams.get("state");
        cb(`https://testid.chromiumapp.org/?code=c&state=${state}`);
      },
    },
  });
  const prevFetch = stubFetch(async (url) => {
    if (String(url).startsWith("https://graph.microsoft.com/v1.0/me")) {
      return { ok: true, status: 200, json: async () => ({ mail: "someone-else@o.c" }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "ms-tok", refresh_token: "ms-rt", expires_in: 3600 }),
    };
  });
  try {
    await assert.rejects(
      getGraphTokenForAccount("wanted@o.c", true, { clientId: "entra-mismatch-2" }),
      /mismatch/,
    );
    assert.match(capturedUrl, /login_hint=wanted%40o\.c/);
    assert.equal(
      stores.session[sessionKeyFor("wanted@o.c")] ?? null,
      null,
      "foreign credential never stored",
    );
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

// Alias case: the typed address matches userPrincipalName while primary
// mail differs (same mailbox, e.g. outlook.com alias over hotmail.com).
// Sign-in must succeed — only wholly unrelated identities reject.
test("microsoft sign-in accepts a Graph alias identity", async () => {
  const stores = memoryStores();
  const prev = installChrome({
    ...stores.chrome,
    runtime: {},
    identity: {
      getRedirectURL: () => "https://testid.chromiumapp.org/",
      launchWebAuthFlow: ({ url }, cb) => {
        const state = new URL(url).searchParams.get("state");
        cb(`https://testid.chromiumapp.org/?code=c&state=${state}`);
      },
    },
  });
  const prevFetch = stubFetch(async (url) => {
    if (String(url).startsWith("https://graph.microsoft.com/v1.0/me")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          mail: "primary@hotmail.com",
          userPrincipalName: "alias@outlook.com",
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "ms-tok", refresh_token: "ms-rt", expires_in: 3600 }),
    };
  });
  try {
    const tok = await getGraphTokenForAccount("alias@outlook.com", true, {
      clientId: "entra-alias-1",
    });
    assert.equal(tok, "ms-tok");
    const stored = stores.session[sessionKeyFor("alias@outlook.com")];
    assert.equal(stored?.accessToken, "ms-tok");
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

// Fix round 2.1 (microsoft): distinct credentials through the real worker
// wiring — no injected token callbacks.
test("outlook records resolve distinct credentials via the real provider", async () => {
  const keyA = sessionKeyFor("r2-a@o.c");
  const keyB = sessionKeyFor("r2-b@o.c");
  const stores = memoryStores({}, {
    [keyA]: { accessToken: "tok-RA", refreshToken: "rt-RA", expiresAt: Date.now() + 3600_000, account: "r2-a@o.c" },
    [keyB]: { accessToken: "tok-RB", refreshToken: "rt-RB", expiresAt: Date.now() + 3600_000, account: "r2-b@o.c" },
  });
  const prev = installChrome(stores.chrome);
  try {
    const accounts = [
      { provider: "outlook", account: "r2-a@o.c", clientId: "entra-real-2" },
      { provider: "outlook", account: "r2-b@o.c", clientId: "entra-real-2" },
    ];
    const provider = buildTokenProvider(accounts);
    assert.equal(await provider.getToken(accounts[0]), "tok-RA");
    assert.equal(await provider.getToken(accounts[1]), "tok-RB");
  } finally {
    restoreChrome(prev);
  }
});

// Feed transport: a dead session surfaces needs sign in through the real
// worker wiring, and Sign in opens the Gmail login tab for recovery.
test("gmail feed 401 marks needs sign in end to end", async () => {
  const { chrome } = memoryStores();
  const prev = installChrome(chrome);
  const prevFetch = stubFetch(async () => ({ ok: false, status: 401 }));
  try {
    const accounts = [{ provider: "gmail", account: "r2g@gmail.com" }];
    const provider = buildTokenProvider(accounts);
    const r = await pollAccount(accounts[0], {
      fetchers: { gmail: fetchGmailMessages },
      getToken: provider.getToken,
      refreshToken: provider.refreshToken,
    });
    assert.equal(r.needsSignIn, true);
    assert.equal(needsSignInFor(accounts[0]), true);
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

// The Sign in handler polls first: a live session recovers with no tab,
// a dead session opens the Gmail login tab and stays needs sign in.
test("gmail sign-in polls first and opens a tab only when auth is missing", async () => {
  const { chrome } = memoryStores();
  const opened = [];
  const prev = installChrome({
    ...chrome,
    tabs: { create: async (opts) => void opened.push(opts.url) },
  });
  try {
    const acct = { provider: "gmail", account: "r2h@gmail.com" };
    const healthy = await handleSignIn([acct], { provider: "gmail", account: "r2h@gmail.com" }, {
      fetchers: {
        gmail: async () => [item("gmail:r2hmsg", "gmail", "r2h@gmail.com")],
      },
    });
    assert.equal(healthy.items?.length, 1);
    assert.equal(healthy.needsSignIn, undefined);
    assert.equal(opened.length, 0, "no tab when the session is live");
    assert.equal(needsSignInFor(acct), false);
    const failing = await handleSignIn([acct], { provider: "gmail", account: "r2h@gmail.com" }, {
      fetchers: {
        gmail: async () => {
          const e = new Error("unauthorized");
          e.status = 401;
          throw e;
        },
      },
    });
    assert.equal(failing.needsSignIn, true);
    assert.ok(opened.includes("https://mail.google.com/"), "login tab opened");
    assert.equal(needsSignInFor(acct), true);
  } finally {
    restoreChrome(prev);
  }
});

test("sign-in recovers a paused Gmail account and later polling stays enabled", async () => {
  const target = { provider: "gmail", account: "paused-recovery@gmail.com", enabled: false, notify: false };
  const other = { provider: "outlook", account: "recovery-other@o.c", enabled: true, notify: false, clientId: "other-entra-id" };
  const otherState = { needsSignIn: false, baseline: true, seen: ["untouched"], marker: "keep" };
  const stores = memoryStores({
    accounts: [target, other],
    accountState: { "outlook:recovery-other@o.c": otherState },
  });
  const prev = installChrome(stores.chrome);
  try {
    const calls = [];
    const deps = {
      interactiveGet: async () => null,
      getToken: async () => null,
      fetchers: {
        gmail: async (_token, _since, account) => {
          calls.push(`gmail:${account}`);
          return [];
        },
        outlook: async (_token, _since, account) => {
          calls.push(`outlook:${account}`);
          return [];
        },
      },
      setBadge: async () => {},
    };
    const recovered = await handleSignIn([target, other], target, deps);
    assert.ok(Array.isArray(recovered.items), "immediate result contains provider items");
    assert.equal(recovered.skipped, undefined);
    assert.deepEqual(calls, ["gmail:paused-recovery@gmail.com"]);
    assert.deepEqual(await loadAccounts(), [
      { ...target, enabled: true },
      other,
    ]);
    assert.deepEqual((await readAccountState())["outlook:recovery-other@o.c"], otherState);

    const persisted = await loadAccounts();
    const later = await pollAll([persisted[0]], {
      ...deps,
      interactiveGet: undefined,
    });
    assert.equal(later.succeeded.includes("gmail:paused-recovery@gmail.com"), true);
    assert.deepEqual(calls, [
      "gmail:paused-recovery@gmail.com",
      "gmail:paused-recovery@gmail.com",
    ]);
  } finally {
    restoreChrome(prev);
  }
});

test("sign-in recovers a paused Outlook account without changing other settings", async () => {
  const target = { provider: "outlook", account: "paused-recovery@o.c", enabled: false, notify: false, clientId: "target-entra-id" };
  const other = { provider: "outlook", account: "recovery-other@o.c", enabled: true, notify: false, clientId: "other-entra-id" };
  const otherState = { needsSignIn: false, baseline: true, seen: ["untouched"], marker: "keep" };
  const tokenKey = sessionKeyFor(target.account);
  const stores = memoryStores({
    accounts: [target, other],
    accountState: { "outlook:recovery-other@o.c": otherState },
  }, {
    [tokenKey]: {
      accessToken: "paused-outlook-token",
      refreshToken: null,
      expiresAt: Date.now() + 3600_000,
      account: target.account,
    },
  });
  const prev = installChrome(stores.chrome);
  try {
    const calls = [];
    const deps = {
      interactiveGet: async (acct) => {
        assert.equal(acct.account, target.account);
        return "paused-outlook-token";
      },
      fetchers: {
        outlook: async (token, _since, account) => {
          assert.equal(token, "paused-outlook-token");
          calls.push(account);
          return [];
        },
      },
      setBadge: async () => {},
    };
    const recovered = await handleSignIn([target, other], target, deps);
    assert.ok(Array.isArray(recovered.items), "immediate result contains provider items");
    assert.equal(recovered.skipped, undefined);
    assert.deepEqual(calls, [target.account]);
    assert.deepEqual(await loadAccounts(), [
      { ...target, enabled: true },
      other,
    ]);
    assert.deepEqual((await readAccountState())["outlook:recovery-other@o.c"], otherState);

    const persisted = await loadAccounts();
    const later = await pollAll([persisted[0]], {
      getToken: async () => "paused-outlook-token",
      fetchers: deps.fetchers,
      setBadge: async () => {},
    });
    assert.equal(later.succeeded.includes("outlook:paused-recovery@o.c"), true);
    assert.deepEqual(calls, [target.account, target.account]);
  } finally {
    restoreChrome(prev);
  }
});

test("paused recovery merges a concurrent settings change to another account", async () => {
  const target = { provider: "gmail", account: "concurrent-recovery@gmail.com", enabled: false, notify: true };
  const other = { provider: "outlook", account: "concurrent-other@o.c", enabled: true, notify: true, clientId: "old-client-id" };
  const updatedOther = { ...other, notify: false, clientId: "new-client-id" };
  const stores = memoryStores({ accounts: [target, other] });
  const prev = installChrome(stores.chrome);
  let releaseFetch;
  let fetchStartedResolve;
  const fetchStarted = new Promise((resolve) => { fetchStartedResolve = resolve; });
  const fetchGate = new Promise((resolve) => { releaseFetch = resolve; });
  try {
    const recovery = handleSignIn([target, other], target, {
      interactiveGet: async () => null,
      fetchers: {
        gmail: async () => {
          fetchStartedResolve();
          await fetchGate;
          return [];
        },
        outlook: async () => { assert.fail("unrelated provider must not be polled"); },
      },
    });
    await fetchStarted;
    await saveAccounts([target, updatedOther]);
    releaseFetch();
    const result = await recovery;
    assert.ok(Array.isArray(result.items));
    assert.deepEqual(await loadAccounts(), [
      { ...target, enabled: true },
      updatedOther,
    ]);
  } finally {
    restoreChrome(prev);
  }
});

test("rejected interactive recovery leaves a paused account disabled and unpolled", async () => {
  const target = { provider: "outlook", account: "rejected-recovery@o.c", enabled: false, notify: true, clientId: "rejected-client-id" };
  const stores = memoryStores({ accounts: [target] });
  const prev = installChrome(stores.chrome);
  try {
    let fetchCount = 0;
    const result = await handleSignIn([target], target, {
      interactiveGet: async () => { throw new Error("cancelled or failed"); },
      fetchers: { outlook: async () => { fetchCount += 1; return []; } },
    });
    assert.equal(result.needsSignIn, true);
    assert.equal(fetchCount, 0);
    assert.deepEqual(await loadAccounts(), [target]);
  } finally {
    restoreChrome(prev);
  }
});

test("paused Gmail stays disabled when its recovery poll receives 401", async () => {
  const target = { provider: "gmail", account: "paused-401@gmail.com", enabled: false, notify: true };
  const stores = memoryStores({ accounts: [target] });
  let opened = 0;
  const prev = installChrome({
    ...stores.chrome,
    tabs: { create: async () => { opened += 1; } },
  });
  try {
    let fetchCount = 0;
    const result = await handleSignIn([target], target, {
      fetchers: { gmail: async () => { fetchCount += 1; throw err401(); } },
    });
    assert.equal(result.needsSignIn, true);
    assert.equal(fetchCount, 2, "one forced Gmail retry follows the 401");
    assert.equal(opened, 1);
    assert.deepEqual(await loadAccounts(), [target]);
  } finally {
    restoreChrome(prev);
  }
});

// Fix round 2.3 (microsoft): renewal 503 keeps the session and stays
// generic end to end — no eviction, no sign-in.
test("microsoft renewal 503 keeps the session and stays generic end to end", async () => {
  const key = sessionKeyFor("r23a@o.c");
  const stores = memoryStores({}, {
    [key]: {
      accessToken: "bad-tok",
      refreshToken: "rt-23",
      expiresAt: Date.now() + 3600_000,
      account: "r23a@o.c",
    },
  });
  const prev = installChrome(stores.chrome);
  const prevFetch = stubFetch(async (url) => {
    assert.equal(String(url), MS_TOKEN_URL);
    return { ok: false, status: 503, json: async () => ({}) };
  });
  try {
    const accounts = [{ provider: "outlook", account: "r23a@o.c", clientId: "entra-503-2" }];
    const provider = buildTokenProvider(accounts);
    const r = await pollAccount(accounts[0], {
      fetchers: {
        outlook: async (token) => {
          assert.equal(token, "bad-tok");
          throw err401();
        },
      },
      getToken: provider.getToken,
      refreshToken: provider.refreshToken,
    });
    assert.ok(r.error, "generic error recorded");
    assert.equal(r.backedOff, true);
    assert.equal(r.needsSignIn, undefined, "no sign-in for a 503 blip");
    assert.ok(r.retryAt > Date.now());
    assert.equal(stores.session[key]?.accessToken, "bad-tok", "slot not evicted");
    assert.equal(stores.session[key]?.refreshToken, "rt-23", "refresh grant kept");
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

// Fix round 2.3 (microsoft): renewal network failure keeps the session.
test("microsoft renewal network failure keeps the session end to end", async () => {
  const key = sessionKeyFor("r23b@o.c");
  const stores = memoryStores({}, {
    [key]: {
      accessToken: "bad-tok",
      refreshToken: "rt-23b",
      expiresAt: Date.now() + 3600_000,
      account: "r23b@o.c",
    },
  });
  const prev = installChrome(stores.chrome);
  const prevFetch = stubFetch(async (url) => {
    assert.equal(String(url), MS_TOKEN_URL);
    throw new TypeError("socket hang up");
  });
  try {
    const accounts = [{ provider: "outlook", account: "r23b@o.c", clientId: "entra-net-2" }];
    const provider = buildTokenProvider(accounts);
    const r = await pollAccount(accounts[0], {
      fetchers: {
        outlook: async () => { throw err401(); },
      },
      getToken: provider.getToken,
      refreshToken: provider.refreshToken,
    });
    assert.ok(r.error);
    assert.equal(r.needsSignIn, undefined, "no sign-in for a network blip");
    assert.equal(stores.session[key]?.accessToken, "bad-tok", "slot not evicted");
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

// Feed transport: a 503 from the feed backs off with no sign-in.
test("gmail feed 503 stays transient end to end", async () => {
  const { chrome } = memoryStores();
  const prev = installChrome(chrome);
  const prevFetch = stubFetch(async (url) => {
    assert.ok(String(url).startsWith("https://mail.google.com/mail/u/"));
    return { ok: false, status: 503 };
  });
  try {
    const accounts = [{ provider: "gmail", account: "r23g@gmail.com" }];
    const provider = buildTokenProvider(accounts);
    const r = await pollAccount(accounts[0], {
      fetchers: { gmail: fetchGmailMessages },
      getToken: provider.getToken,
      refreshToken: provider.refreshToken,
    });
    assert.ok(r.error, "generic error recorded");
    assert.equal(r.backedOff, true);
    assert.equal(r.needsSignIn, undefined, "no sign-in for a 503 blip");
    assert.equal(r.offline, undefined);
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

test("microsoft sign-out clears all slots and grants stay unusable", async () => {
  const keyA = sessionKeyFor("r24a@o.c");
  const keyB = sessionKeyFor("r24b@o.c");
  const stores = memoryStores({}, {
    [MS_SESSION_KEY]: { accessToken: "tok-L", expiresAt: Date.now() + 3600_000 },
    [keyA]: { accessToken: "tok-A", refreshToken: "rt-A", expiresAt: Date.now() + 3600_000, account: "r24a@o.c" },
    [keyB]: { accessToken: "tok-B", refreshToken: "rt-B", expiresAt: Date.now() + 3600_000, account: "r24b@o.c" },
  });
  const removed = [];
  const session = stores.chrome.storage.session;
  const origRemove = session.remove;
  session.remove = async (k) => { removed.push(k); return origRemove(k); };
  const prev = installChrome(stores.chrome);
  try {
    configureMicrosoftAuth({ clientId: "entra-clear-2" });
    assert.equal(await clearGraphToken(), true);
    assert.ok(removed.includes(MS_SESSION_KEY), "legacy slot removed");
    assert.ok(removed.includes(keyA) && removed.includes(keyB), "per-account slots removed");
    assert.equal(await readSessionRecord(), null);
    await assert.rejects(getGraphTokenForAccount("r24a@o.c", false), /needs sign in/);
    await assert.rejects(getGraphTokenForAccount("r24b@o.c", false), /needs sign in/);
  } finally {
    restoreChrome(prev);
  }
});

// Feed transport keeps no credentials: Gmail sign-out is local-only state
// with nothing to clear, and polling stays signed out until Sign in.
test("gmail sign-out keeps working with no credential slots", async () => {
  const { chrome } = memoryStores();
  const prev = installChrome(chrome);
  try {
    const acct = { provider: "gmail", account: "r24g@gmail.com" };
    const provider = buildTokenProvider([acct]);
    assert.equal(await provider.getToken(acct), null);
    assert.equal(await provider.refreshToken(acct, null), null);
  } finally {
    restoreChrome(prev);
  }
});

// Fix round 3.1 (microsoft): a seeded credential whose /me identity differs
// from the requested account is rejected through the real worker wiring —
// never stored, never used for fetching.
test("worker rejects a mismatched microsoft identity instead of using it", async () => {
  const key = sessionKeyFor("r31@o.c");
  const stores = memoryStores({}, {
    [key]: {
      accessToken: "bad-tok",
      refreshToken: "rt-31",
      expiresAt: Date.now() + 3600_000,
      account: "r31@o.c",
    },
  });
  const prev = installChrome(stores.chrome);
  const usedTokens = [];
  const prevFetch = stubFetch(async (url) => {
    if (String(url).startsWith("https://graph.microsoft.com/v1.0/me")) {
      return { ok: true, status: 200, json: async () => ({ mail: "someone-else@o.c" }) };
    }
    assert.equal(String(url), MS_TOKEN_URL);
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "rotated-tok", expires_in: 3600 }),
    };
  });
  try {
    const accounts = [{ provider: "outlook", account: "r31@o.c", clientId: "entra-renew-31" }];
    const provider = buildTokenProvider(accounts);
    const r = await pollAccount(accounts[0], {
      fetchers: {
        outlook: async (token) => {
          usedTokens.push(token);
          if (token === "bad-tok") throw err401();
          return [item(`outlook:r31-${token}`, "outlook", "r31@o.c")];
        },
      },
      getToken: provider.getToken,
      refreshToken: provider.refreshToken,
    });
    assert.equal(r.needsSignIn, true, "foreign grant drives interactive recovery");
    assert.ok(!usedTokens.includes("rotated-tok"), "rotated credential never used");
    assert.ok(!getInbox().find((i) => i.key.startsWith("outlook:r31-")), "nothing fetched");
    assert.equal(stores.session[key] ?? null, null, "mismatched slot evicted, never rebound");
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

// Fix round 3.3 (microsoft): enumeration failure rejects instead of
// reporting success over slots that may remain usable.
test("microsoft sign-out rejects when slot enumeration fails", async () => {
  const keyA = sessionKeyFor("r33a@o.c");
  const stores = memoryStores({}, {
    [keyA]: { accessToken: "tok-33a", expiresAt: Date.now() + 3600_000, account: "r33a@o.c" },
  });
  const session = stores.chrome.storage.session;
  session.get = async (k) => {
    if (k == null) throw new Error("quota db locked");
    return { [k]: null };
  };
  const prev = installChrome(stores.chrome);
  try {
    configureMicrosoftAuth({ clientId: "entra-enum-3" });
    await assert.rejects(clearGraphToken(), /sign out failed/);
    assert.ok(stores.session[keyA], "unverifiable slot left untouched, failure reported");
  } finally {
    restoreChrome(prev);
  }
});

// Feed transport shares the browser session: one dead session marks
// needs sign in, and a later successful poll clears it.
test("gmail feed 401 marks needs sign in until the session recovers", async () => {
  const { chrome } = memoryStores();
  const prev = installChrome(chrome);
  const feedFor = (account) => ({
    ok: true,
    status: 200,
    text: async () => `<?xml version="1.0"?><feed xmlns="http://purl.org/atom/ns#"><title>Gmail - Inbox for ${account}</title><fullcount>1</fullcount><entry><title>s</title><summary>p</summary><link rel="alternate" href="https://mail.google.com/mail/u/0/#inbox/abc123"/><issued>2024-09-27T09:00:00Z</issued><author><name>a</name><email>${account}</email></author></entry></feed>`,
  });
  const notFound = { ok: false, status: 404, text: async () => "" };
  const unauthorized = { ok: false, status: 401, text: async () => "" };
  const prevFetch = globalThis.fetch;
  try {
    const accounts = [{ provider: "gmail", account: "r34a@gmail.com" }];
    const provider = buildTokenProvider(accounts);
    const deps = {
      fetchers: { gmail: fetchGmailMessages },
      getToken: provider.getToken,
      refreshToken: provider.refreshToken,
      since: 0,
    };
    globalThis.fetch = async () => unauthorized;
    const failed = await pollAccount(accounts[0], deps);
    assert.equal(failed.needsSignIn, true);
    assert.equal(needsSignInFor(accounts[0]), true);
    globalThis.fetch = async (url) =>
      String(url).includes("/u/0/") ? feedFor("r34a@gmail.com") : notFound;
    const recovered = await pollAccount(accounts[0], deps);
    assert.equal(recovered.items?.length, 1);
    assert.equal(needsSignInFor(accounts[0]), false);
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});
