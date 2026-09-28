// Sign-out races and explicit sign-out failures. No live OAuth; chrome
// and fetch are stubbed with delayed responses to force overlap.

import test from "node:test";
import assert from "node:assert";
import { clearGmailToken } from "../src/auth/google.js";
import {
  configureMicrosoftAuth,
  getGraphToken,
  clearGraphToken,
  readSessionRecord,
  MS_SESSION_KEY,
} from "../src/auth/microsoft.js";

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

test("clearGmailToken reports cache removal failure", async () => {
  const prev = globalThis.chrome;
  globalThis.chrome = {
    runtime: { lastError: { message: "cache busy" } },
    identity: { removeCachedAuthToken: (_details, cb) => cb() },
  };
  try {
    await assert.rejects(() => clearGmailToken("tok"), /google sign out failed/);
  } finally {
    globalThis.chrome = prev;
  }
});

test("clearGmailToken resolves true on success, false when nothing to clear", async () => {
  const prev = globalThis.chrome;
  globalThis.chrome = {
    runtime: {},
    identity: { removeCachedAuthToken: (_details, cb) => cb() },
  };
  try {
    assert.equal(await clearGmailToken("tok"), true);
    assert.equal(await clearGmailToken(undefined), false);
  } finally {
    globalThis.chrome = prev;
  }
  globalThis.chrome = undefined;
  try {
    assert.equal(await clearGmailToken("tok"), false);
  } finally {
    globalThis.chrome = prev;
  }
});
