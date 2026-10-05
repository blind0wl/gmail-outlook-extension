// Outlook tokens live in chrome.storage.session, which Chrome clears on
// browser restart and extension reload. A silent poll that finds no record
// must recover from the browser's Microsoft login without showing UI.

import test from "node:test";
import assert from "node:assert";
import {
  configureMicrosoftAuth,
  getGraphTokenForAccount,
  clearGraphToken,
  readSessionRecord,
  sessionKeyFor,
} from "../src/auth/microsoft.js";

const ACCT = "silent@outlook.com";

// net: "up" reaches Microsoft, "flow-down" fails the auth window before
// any callback, "fetch-down" fails the token request.
function fakeBrowser({ browserLogin }) {
  const local = {};
  const session = {};
  const runtime = {};
  const fake = { net: "up", flows: [] };
  fake.chrome = {
    runtime,
    storage: {
      local: {
        set: async (obj) => void Object.assign(local, obj),
        get: async (k) => ({ [k]: local[k] }),
      },
      session: {
        get: async (k) => (k == null ? { ...session } : { [k]: session[k] ?? null }),
        set: async (obj) => void Object.assign(session, obj),
        remove: async (k) => void delete session[k],
      },
    },
    identity: {
      getRedirectURL: () => "https://testid.chromiumapp.org/",
      launchWebAuthFlow: (opts, cb) => {
        const url = new URL(opts.url);
        fake.flows.push({
          interactive: opts.interactive,
          abortOnLoadForNonInteractive: opts.abortOnLoadForNonInteractive,
          prompt: url.searchParams.get("prompt"),
          loginHint: url.searchParams.get("login_hint"),
        });
        if (fake.net === "flow-down") {
          runtime.lastError = { message: "net::ERR_INTERNET_DISCONNECTED" };
          cb(undefined);
          delete runtime.lastError;
          return;
        }
        const state = url.searchParams.get("state");
        cb(
          browserLogin
            ? `https://testid.chromiumapp.org/?code=c&state=${state}`
            : `https://testid.chromiumapp.org/?error=login_required&state=${state}`,
        );
      },
    },
  };
  fake.fetch = async (url) => {
    if (fake.net === "fetch-down") throw new TypeError("Failed to fetch");
    if (String(url).startsWith("https://graph.microsoft.com/v1.0/me")) {
      return { ok: true, status: 200, json: async () => ({ mail: ACCT }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "ms-silent", refresh_token: "rt-silent", expires_in: 3600 }),
    };
  };
  return fake;
}

async function withBrowser(browserLogin, run) {
  const fake = fakeBrowser({ browserLogin });
  const prevChrome = globalThis.chrome;
  const prevFetch = globalThis.fetch;
  globalThis.chrome = fake.chrome;
  globalThis.fetch = fake.fetch;
  configureMicrosoftAuth({ clientId: "entra-silent" });
  try {
    await run(fake);
  } finally {
    globalThis.chrome = prevChrome;
    globalThis.fetch = prevFetch;
  }
}

const needsSignIn = (err) => err.reason === "missing-record" && !err.transient;

test("silent poll after restart signs in from the browser's Microsoft login without UI", async () => {
  await withBrowser(true, async ({ flows }) => {
    assert.equal(await getGraphTokenForAccount(ACCT, false), "ms-silent");
    assert.deepEqual(flows, [
      { interactive: false, abortOnLoadForNonInteractive: false, prompt: "none", loginHint: ACCT },
    ]);
    const record = await readSessionRecord(sessionKeyFor(ACCT));
    assert.equal(record.refreshToken, "rt-silent");
    assert.equal(record.account, ACCT);
  });
});

test("without a browser login the silent poll needs sign in and tries only once per session", async () => {
  await withBrowser(false, async ({ flows }) => {
    for (let i = 0; i < 3; i++) {
      await assert.rejects(getGraphTokenForAccount(ACCT, false), needsSignIn);
    }
    assert.equal(flows.length, 1);
    assert.equal(await readSessionRecord(sessionKeyFor(ACCT)), null);
  });
});

test("an explicitly signed-out account never attempts silent sign in", async () => {
  await withBrowser(true, async ({ flows }) => {
    await clearGraphToken(ACCT);
    await assert.rejects(getGraphTokenForAccount(ACCT, false), (err) => err.reason === "signed-out");
    assert.equal(flows.length, 0);
  });
});

test("a silent attempt that never reached Microsoft retries on the next poll", async () => {
  await withBrowser(true, async (fake) => {
    fake.net = "flow-down";
    await assert.rejects(getGraphTokenForAccount(ACCT, false), needsSignIn);
    fake.net = "up";
    assert.equal(await getGraphTokenForAccount(ACCT, false), "ms-silent");
    assert.equal(fake.flows.length, 2);
  });
});

test("a transient token failure stays transient and retries on the next poll", async () => {
  await withBrowser(true, async (fake) => {
    fake.net = "fetch-down";
    await assert.rejects(getGraphTokenForAccount(ACCT, false), (err) => err.transient === true);
    fake.net = "up";
    assert.equal(await getGraphTokenForAccount(ACCT, false), "ms-silent");
    assert.equal(fake.flows.length, 2);
  });
});
