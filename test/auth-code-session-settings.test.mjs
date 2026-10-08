import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_CODE_AUTO_COPY_KEY,
  authCodeAutoCopyEnabled,
  readAuthCodeAutoCopy,
} from "../src/auth-codes/settings.js";
import {
  clearAuthCodeRecords,
  getPendingAuthCode,
  mapNotificationToMessage,
  messageForNotification,
  savePendingAuthCode,
} from "../src/auth-codes/session.js";

function storageDouble() {
  const values = {};
  return {
    values,
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((key) => key in values).map((key) => [key, values[key]]));
    },
    async set(patch) { Object.assign(values, patch); },
  };
}

test("automatic copying is opt-in and reads the persisted preference", async () => {
  const local = storageDouble();
  const prior = globalThis.chrome;
  globalThis.chrome = { storage: { local } };
  try {
    assert.equal(authCodeAutoCopyEnabled(undefined), false);
    assert.equal(authCodeAutoCopyEnabled({ [AUTH_CODE_AUTO_COPY_KEY]: false }), false);
    assert.equal(authCodeAutoCopyEnabled({ [AUTH_CODE_AUTO_COPY_KEY]: true }), true);
    assert.equal(await readAuthCodeAutoCopy(), false);
    await local.set({ [AUTH_CODE_AUTO_COPY_KEY]: true });
    assert.equal(await readAuthCodeAutoCopy(), true);
  } finally {
    globalThis.chrome = prior;
  }
});

test("pending codes live in session storage, expire on read, and notification ids map without codes", async () => {
  const session = storageDouble();
  const local = storageDouble();
  const prior = globalThis.chrome;
  globalThis.chrome = { storage: { session, local } };
  const key = "gmail:test:message-1";
  const now = 1_800_000_000_000;
  try {
    assert.equal(await savePendingAuthCode(key, "031208", now + 1_000, now, now), true);
    assert.equal(await savePendingAuthCode(key, "031208", now + 1_000, now, now), false);
    assert.equal((await getPendingAuthCode(key, now)).code, "031208");
    await mapNotificationToMessage("auth-code:1", key, now + 1_000);
    assert.equal(await messageForNotification("auth-code:1", now), key);
    assert.equal(JSON.stringify(local.values).includes("031208"), false);
    assert.equal(JSON.stringify(session.values).includes("031208"), true);
    assert.equal(await getPendingAuthCode(key, now + 1_001), null);
    assert.equal("gmail:test:message-1" in session.values.pendingAuthCodes, false);
    assert.equal(Object.keys(session.values.processedAuthCodes).length, 0);
    assert.equal(await messageForNotification("auth-code:1", now + 1_001), null);
    assert.equal(Object.keys(session.values.authCodeNotifications).length, 0);
    await clearAuthCodeRecords([key]);
    assert.equal(await messageForNotification("auth-code:1", now), null);
  } finally {
    globalThis.chrome = prior;
  }
});
