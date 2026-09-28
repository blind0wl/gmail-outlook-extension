// Fix round 1: per-account token identity, MS configure ordering, forced
// renewal, token-error classes, stale marker. Chrome identity and network
// are stubbed; no live OAuth, no tokens leave the process.

import test from "node:test";
import assert from "node:assert";
import {
  getGmailTokenForAccount,
  renewGmailToken,
  googleSessionKey,
} from "../src/auth/google.js";
import {
  configureMicrosoftAuth,
  getConfiguredClientId,
  getGraphTokenForAccount,
  renewGraphToken,
  sessionKeyFor,
} from "../src/auth/microsoft.js";
import {
  pollAccount,
  pollAll,
  buildTokenProvider,
  handleSignIn,
  needsSignInFor,
} from "../src/background/service-worker.js";
import { getInbox, mergeMessages } from "../src/store/cache.js";
import { accountStatusLabel, readAccountState } from "../src/notify/notify.js";

const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
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
          get: async (k) => ({ [k]: session[k] ?? null }),
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

// Fix 1 (worker): two Gmail records poll with distinct per-account
// credentials across both callback paths (getToken and refreshToken).
test("two gmail accounts poll with distinct per-account credentials", async () => {
  const { local, chrome } = memoryStores();
  void local;
  const prev = installChrome(chrome);
  try {
    const a = { provider: "gmail", account: "t1-a@gmail.com" };
    const b = { provider: "gmail", account: "t1-b@gmail.com" };
    const creds = {
      "t1-a@gmail.com": { old: "old-A", fresh: "fresh-A" },
      "t1-b@gmail.com": { old: "old-B", fresh: "fresh-B" },
    };
    const fetchers = {
      gmail: async (token) => {
        if (token === "old-A" || token === "old-B") throw err401();
        const owner = Object.keys(creds).find((acc) => creds[acc].fresh === token);
        if (!owner) {
          const e = new Error("foreign token");
          e.status = 403;
          throw e;
        }
        return [item(`gmail:t1-${owner}`, "gmail", owner)];
      },
    };
    const summary = await pollAll([a, b], {
      fetchers,
      getToken: async (acct) => creds[acct.account].old,
      refreshToken: async (acct) => creds[acct.account].fresh,
      notify: async () => {},
      setBadge: async () => {},
    });
    assert.ok(summary.succeeded.includes("gmail:t1-a@gmail.com"));
    assert.ok(summary.succeeded.includes("gmail:t1-b@gmail.com"));
    // A crossed credential would file both messages under one address.
    assert.ok(getInbox().find((i) => i.key === "gmail:t1-t1-a@gmail.com"));
    assert.ok(getInbox().find((i) => i.key === "gmail:t1-t1-b@gmail.com"));
  } finally {
    restoreChrome(prev);
  }
});

// Fix 1 (google): silent acquisition never returns a foreign credential.
test("gmail silent token rejects a foreign credential", async () => {
  const prev = installChrome({
    identity: { getAuthToken: (_opts, cb) => cb("tok-default") },
  });
  const prevFetch = stubFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ emailAddress: "primary@gmail.com" }),
  }));
  try {
    assert.equal(await getGmailTokenForAccount("primary@gmail.com", false), "tok-default");
    await assert.rejects(
      getGmailTokenForAccount("secondary@gmail.com", false),
      /mismatch/,
    );
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

// Fix 1 (google): interactive switch pins login_hint and binds the result.
test("gmail interactive switch uses login_hint and binds the credential", async () => {
  const stores = memoryStores();
  let capturedUrl = null;
  const prev = installChrome({
    ...stores.chrome,
    runtime: { getManifest: () => ({ oauth2: { client_id: "g-client" } }) },
    identity: {
      getAuthToken: (_opts, cb) => cb("tok-default"),
      getRedirectURL: () => "https://testid.chromiumapp.org/",
      launchWebAuthFlow: ({ url }, cb) => {
        capturedUrl = url;
        const state = new URL(url).searchParams.get("state");
        cb(`https://testid.chromiumapp.org/?code=cc&state=${state}`);
      },
    },
  });
  const prevFetch = stubFetch(async (url) => {
    if (String(url) === GOOGLE_TOKEN_URL) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok-2", refresh_token: "rt-2", expires_in: 3600 }),
      };
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  const router = globalThis.fetch;
  // Profile owner follows the presented credential.
  globalThis.fetch = async (url, opts) => {
    if (String(url) === GMAIL_PROFILE_URL) {
      const token = String(opts?.headers?.Authorization ?? "").replace("Bearer ", "");
      const owner = token === "tok-2" ? "secondary@gmail.com" : "primary@gmail.com";
      return { ok: true, status: 200, json: async () => ({ emailAddress: owner }) };
    }
    return router(url, opts);
  };
  try {
    const token = await getGmailTokenForAccount("secondary@gmail.com", true);
    assert.equal(token, "tok-2");
    const params = new URL(capturedUrl).searchParams;
    assert.equal(params.get("login_hint"), "secondary@gmail.com");
    assert.ok(params.get("code_challenge"), "PKCE challenge present");
    assert.equal(params.get("client_id"), "g-client");
    const stored = stores.session[googleSessionKey("secondary@gmail.com")];
    assert.equal(stored?.accessToken, "tok-2");
    assert.equal(stored?.account, "secondary@gmail.com");
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
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

// Fix 3 (google): the rejected token is evicted from the Chrome cache,
// then silently refetched — never returned again.
test("google renewal evicts the rejected token before refetching", async () => {
  const evicted = [];
  const stores = memoryStores({}, {
    [googleSessionKey("t7@gmail.com")]: {
      accessToken: "old-g",
      refreshToken: null,
      expiresAt: Date.now() + 3600_000,
      account: "t7@gmail.com",
    },
  });
  const prev = installChrome({
    ...stores.chrome,
    identity: {
      removeCachedAuthToken: ({ token }, cb) => void (evicted.push(token), cb()),
      getAuthToken: (_opts, cb) => cb("new-g"),
    },
  });
  const prevFetch = stubFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ emailAddress: "t7@gmail.com" }),
  }));
  try {
    assert.equal(await renewGmailToken("t7@gmail.com", "old-g"), "new-g");
    assert.ok(evicted.includes("old-g"), "rejected token evicted from Chrome cache");
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
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
