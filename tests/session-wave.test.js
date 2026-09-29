import test from "node:test";
import assert from "node:assert/strict";
import {
  renewGraphToken,
  clearGraphToken,
  sessionKeyFor,
  getGraphTokenForAccount,
} from "../src/auth/microsoft.js";
const record = { accessToken: "old", refreshToken: "refresh", expiresAt: 0 };
function store(seed = {}) {
  return {
    data: structuredClone(seed),
    async get(k) {
      return k === null
        ? structuredClone(this.data)
        : { [k]: structuredClone(this.data[k]) };
    },
    async set(v) {
      Object.assign(this.data, v);
    },
    async remove(k) {
      delete this.data[k];
    },
  };
}
for (const provider of ["outlook"])
  test(`${provider} sign-out during session read prevents revival and preserves another account`, async () => {
    const key = sessionKeyFor;
    const session = store({
      [key("a")]: record,
      [key("b")]: {
        ...record,
        accessToken: "other",
        expiresAt: Date.now() + 3600000,
      },
    });
    const local = store();
    let resume;
    const gate = new Promise((r) => (resume = r));
    const original = session.get.bind(session);
    let entered;
    const started = new Promise((r) => (entered = r));
    let first = true;
    session.get = async (k) => {
      const v = await original(k);
      if (k === key("a") && first) {
        first = false;
        entered();
        await gate;
      }
      return v;
    };
    globalThis.chrome = {
      storage: { session, local },
      runtime: { getManifest: () => ({ oauth2: { client_id: "client" } }) },
      identity: {
        getAuthToken: (_d, cb) => cb("chrome"),
        removeCachedAuthToken: (_d, cb) => cb(),
      },
    };
    globalThis.fetch = async (url) => ({
      ok: true,
      json: async () =>
        String(url).includes("token")
          ? { access_token: "revived", expires_in: 3600 }
          : { emailAddress: "a", mail: "a" },
    });
    const pending = renewGraphToken("a", "old", { clientId: "client" });
    const outcome = pending.then(
      (v) => ({ v }),
      (e) => ({ e }),
    );
    await started;
    await clearGraphToken("a");
    resume();
    assert.ok((await outcome).e, "pending auth must reject");
    assert.equal(session.data[key("a")], undefined);
    assert.equal(session.data[key("b")].accessToken, "other");
    await assert.rejects(() =>
      getGraphTokenForAccount("a", false, { clientId: "client" }),
    );
  });
for (const provider of ["outlook"])
  test(`${provider} delayed storage write is followed by removal and cannot return a usable token`, async () => {
    const key = sessionKeyFor;
    const session = store({
      [key("b")]: { accessToken: "other", expiresAt: Date.now() + 3600000 },
      ...(provider === "outlook" ? { [key("a")]: record } : {}),
    });
    const local = store();
    let finish, entered;
    const gate = new Promise((r) => (finish = r)),
      started = new Promise((r) => (entered = r));
    const original = session.set.bind(session);
    session.set = async (value) => {
      if (value[key("a")]) {
        entered();
        await gate;
      }
      await original(value);
    };
    globalThis.chrome = {
      storage: { session, local },
      identity: {
        getAuthToken: (_d, cb) => cb("new"),
        removeCachedAuthToken: (_d, cb) => cb(),
      },
    };
    globalThis.fetch = async (url) => ({
      ok: true,
      json: async () =>
        String(url).includes("/token")
          ? { access_token: "new", expires_in: 3600 }
          : { emailAddress: "a", mail: "a" },
    });
    const pending = renewGraphToken("a", "old", { clientId: "client" });
    const outcome = pending.then(
      (v) => ({ v }),
      (e) => ({ e }),
    );
    await started;
    const clearing = clearGraphToken("a");
    finish();
    await clearing;
    assert.ok((await outcome).e);
    assert.equal(session.data[key("a")], undefined);
    assert.equal(session.data[key("b")].accessToken, "other");
  });
for (const provider of ["outlook"])
  test(`${provider} per-account sign-out does not enumerate or remove legacy and other slots`, async () => {
    const key = sessionKeyFor;
    const session = store({
      [key("a")]: record,
      [key("b")]: record,
      [key("")]: record,
    });
    const original = session.get.bind(session);
    session.get = async (k) => {
      if (k === null) throw new Error("enumeration forbidden");
      return original(k);
    };
    globalThis.chrome = {
      storage: { session, local: store() },
      identity: { removeCachedAuthToken: (_d, cb) => cb() },
    };
    await clearGraphToken("a");
    assert.equal(session.data[key("a")], undefined);
    assert.ok(session.data[key("b")]);
    assert.ok(session.data[key("")]);
  });
test("Microsoft callback errors cannot include provider exception text", async () => {
  const { parseAuthCallback } = await import("../src/auth/microsoft.js");
  assert.throws(
    () =>
      parseAuthCallback(
        "https://extension.chromiumapp.org/?error=private_mail_content&state=ok",
        "ok",
      ),
    (error) => !error.message.includes("private_mail_content"),
  );
});
