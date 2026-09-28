// One-argument getGraphToken contract: module-level client configuration.
// No live OAuth, no network; session store is stubbed.

import test from "node:test";
import assert from "node:assert";
import {
  configureMicrosoftAuth,
  getConfiguredClientId,
  getGraphToken,
} from "../src/auth/microsoft.js";

// NOTE: this file never calls configureMicrosoftAuth before the first
// test, and node runs each test file in its own process, so the
// unconfigured assertion below observes genuinely fresh module state.

test("one-arg getGraphToken rejects when no client id is configured", async () => {
  await assert.rejects(() => getGraphToken(true), /clientId not configured/);
});

test("configureMicrosoftAuth enables the promised one-arg form", async () => {
  assert.throws(() => configureMicrosoftAuth({}), /clientId required/);
  configureMicrosoftAuth({ clientId: "test-client-id" });
  assert.equal(getConfiguredClientId(), "test-client-id");

  const prev = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      session: {
        data: {
          "auth.microsoft.graph": {
            accessToken: "fresh-token",
            refreshToken: "rt",
            expiresAt: Date.now() + 3600_000,
          },
        },
        async get(k) {
          return { [k]: this.data[k] ?? null };
        },
      },
    },
  };
  try {
    assert.equal(await getGraphToken(true), "fresh-token");
    assert.equal(await getGraphToken(false), "fresh-token");
  } finally {
    globalThis.chrome = prev;
  }
});
