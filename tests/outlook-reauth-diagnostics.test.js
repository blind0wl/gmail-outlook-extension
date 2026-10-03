// #20: Outlook reauth diagnostics. Chrome identity and network are stubbed;
// no live OAuth, no tokens leave the process. These regressions prove that a
// silent (non-interactive) Outlook failure keeps its sanitized cause — HTTP
// status, endpoint error code, and a stable reason — instead of collapsing to
// a generic "needs sign in" that cannot distinguish missing credentials,
// failed renewal, rejected Graph tokens, or explicit sign-out.

import test from "node:test";
import assert from "node:assert";
import {
  getGraphTokenForAccount,
  getGraphToken,
  renewGraphToken,
  sessionKeyFor,
} from "../src/auth/microsoft.js";
import { sanitizeError, accountStatusLabel, readAccountState } from "../src/notify/notify.js";
import { pollAll } from "../src/background/service-worker.js";

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

const expiredRecord = (account) => ({
  accessToken: "stale-tok",
  refreshToken: "dead-rt",
  expiresAt: Date.now() - 60_000,
  account,
});

// Dead refresh grant must keep its endpoint identifiers on the silent error.
test("silent dead-grant failure keeps status and endpoint code", async () => {
  const account = "diag1@o.c";
  const key = sessionKeyFor(account);
  const { chrome } = memoryStores({}, { [key]: expiredRecord(account) });
  const prev = installChrome(chrome);
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: "invalid_grant" }),
  });
  try {
    const err = await getGraphTokenForAccount(account, false, { clientId: "entra-diag-1" })
      .then(() => null, (e) => e);
    assert.ok(err, "silent acquisition must reject on a dead grant");
    assert.equal(err.status, 400);
    assert.match(String(err.code ?? ""), /invalid_grant/);
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

// Missing session record must be distinguishable from a failed renewal.
test("silent failure with no stored credential names its reason", async () => {
  const account = "diag2@o.c";
  const { chrome } = memoryStores();
  const prev = installChrome(chrome);
  try {
    const err = await getGraphTokenForAccount(account, false, { clientId: "entra-diag-2" })
      .then(() => null, (e) => e);
    assert.ok(err, "silent acquisition must reject with no stored credential");
    assert.equal(err.reason, "missing-record");
  } finally {
    restoreChrome(prev);
  }
});

// The poll boundary sanitizer must keep allowlisted cause identifiers.
test("sanitizeError keeps status and allowlisted code, drops free text", async () => {
  const raw = new Error("poll failed: 400 with invalid_grant for diag3@o.c");
  raw.status = 400;
  raw.code = "invalid_grant";
  raw.reason = "refresh-failed";
  raw.accessToken = "secret-tok";
  const clean = sanitizeError(raw, { account: "diag3@o.c" });
  assert.equal(clean.status, 400);
  assert.equal(clean.code, "invalid_grant");
  assert.equal(clean.reason, "refresh-failed");
  assert.equal(clean.accessToken, undefined);
  assert.doesNotMatch(clean.message, /secret-tok/);
});

// Privacy guard: hostile identifiers are stripped, never passed through.
test("sanitizeError strips hostile code content", async () => {
  const raw = new Error("x");
  raw.code = "invalid_grant; DROP TABLE tokens; <script>";
  const clean = sanitizeError(raw, { account: "diag4@o.c" });
  assert.doesNotMatch(String(clean.code ?? ""), /[;<> ]/);
  assert.doesNotMatch(clean.message, /DROP TABLE/);
});

// The persisted needs-sign-in row carries the sanitized cause end to end.
test("poll persists cause and label shows it on the Outlook row", async () => {
  const account = "diag5@o.c";
  const { chrome } = memoryStores();
  const prev = installChrome(chrome);
  try {
    const acct = { provider: "outlook", account };
    const dead = () => {
      const e = new Error("microsoft auth needs sign in");
      e.code = "invalid_grant";
      e.reason = "refresh-failed";
      e.status = 400;
      throw e;
    };
    const summary = await pollAll([acct], {
      fetchers: { outlook: async () => [] },
      getToken: async () => dead(),
      notify: async () => {},
      setBadge: async () => {},
    });
    assert.ok(summary.needsSignIn.includes(`outlook:${account}`));
    const stored = await readAccountState();
    const entry = stored[`outlook:${account}`];
    assert.equal(entry?.needsSignIn, true);
    assert.equal(entry?.code, "invalid_grant");
    assert.equal(entry?.reason, "refresh-failed");
    const label = accountStatusLabel(acct, entry);
    assert.match(label, /needs sign in \(invalid_grant\)/);
    assert.doesNotMatch(label, /secret|mail content/i);
  } finally {
    restoreChrome(prev);
  }
});

// Gmail rows and causeless rows keep their existing copy.
test("gmail and causeless rows keep existing needs-sign-in copy", async () => {
  const gmailLabel = accountStatusLabel(
    { provider: "gmail", account: "diag6@gmail.com" },
    { needsSignIn: true },
  );
  assert.match(gmailLabel, /log into Gmail/);
  assert.doesNotMatch(gmailLabel, /invalid_grant|session ended/);
  const plainLabel = accountStatusLabel(
    { provider: "outlook", account: "diag7@o.c" },
    { needsSignIn: true },
  );
  assert.equal(plainLabel, "diag7@o.c — needs sign in");
  const endedLabel = accountStatusLabel(
    { provider: "outlook", account: "diag8@o.c" },
    { needsSignIn: true, reason: "missing-record" },
  );
  assert.match(endedLabel, /needs sign in \(session ended\)/);
});

test("diagnostics reject private strings even when they contain only identifier characters", () => {
  for (const code of ["secret-access-token_123", "private-mail-subject", "invalid_grant; DROP TABLE tokens; <script>"]) {
    const clean = sanitizeError({ code }, { account: "privacy@o.c" });
    assert.equal(clean.code, undefined);
    assert.doesNotMatch(accountStatusLabel({ provider: "outlook", account: "privacy@o.c" },
      { needsSignIn: true, code }), /secret-access|private-mail|DROP TABLE/);
  }
  assert.equal(sanitizeError({ code: "invalid_grant/AADSTS700082" }).code,
    "invalid_grant/AADSTS700082");
});

test("forced renewal persists the endpoint rejection after a Graph 401", async () => {
  const account = "forced-diag@o.c";
  const key = sessionKeyFor(account);
  const { chrome, session } = memoryStores({}, { [key]: {
    ...expiredRecord(account), expiresAt: Date.now() + 3_600_000,
  } });
  const prev = installChrome(chrome);
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 400,
    json: async () => ({ error: "invalid_grant", error_description: "AADSTS700082: private description" }),
  });
  try {
    const acct = { provider: "outlook", account };
    const summary = await pollAll([acct], {
      getToken: async () => getGraphTokenForAccount(account, false),
      refreshToken: async (_acct, token) => renewGraphToken(account, token),
      fetchers: { outlook: async () => { throw Object.assign(new Error("Graph refused token"), { status: 401 }); } },
      notify: async () => {}, setBadge: async () => {},
    });
    assert.ok(summary.needsSignIn.includes(`outlook:${account}`));
    const entry = (await readAccountState())[`outlook:${account}`];
    assert.equal(entry.code, "invalid_grant/AADSTS700082");
    assert.equal(entry.status, 400);
    assert.equal(entry.reason, "refresh-failed");
    assert.equal(session[key], undefined);
    assert.match(accountStatusLabel(acct, entry), /invalid_grant\/AADSTS700082/);
  } finally {
    restoreChrome(prev);
    globalThis.fetch = prevFetch;
  }
});

test("storage failures while checking sign-out remain transient for both token entry points", async () => {
  const { chrome } = memoryStores();
  chrome.storage.local.get = async () => { throw new Error("private storage exception"); };
  const prev = installChrome(chrome);
  try {
    for (const acquire of [() => getGraphTokenForAccount("storage-diag@o.c", false), () => getGraphToken(false)]) {
      await assert.rejects(acquire, err => {
        assert.equal(err.transient, true);
        assert.notEqual(err.reason, "signed-out");
        assert.doesNotMatch(err.message, /private|needs sign in/);
        return true;
      });
    }
  } finally { restoreChrome(prev); }
});

test("explicit sign-out keeps its diagnostic reason", async () => {
  const { chrome } = memoryStores({ "signedOut:outlook:signedout-diag@o.c": true });
  const prev = installChrome(chrome);
  try {
    await assert.rejects(() => getGraphTokenForAccount("signedout-diag@o.c", false), err => {
      assert.equal(err.reason, "signed-out");
      assert.notEqual(err.transient, true);
      return true;
    });
  } finally { restoreChrome(prev); }
});
