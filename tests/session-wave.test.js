import test from "node:test";
import assert from "node:assert/strict";
import {
  getGmailTokenForAccount,
  clearGmailToken,
  googleSessionKey,
} from "../src/auth/google.js";
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
for (const provider of ["gmail", "outlook"])
  test(`${provider} sign-out during session read prevents revival and preserves another account`, async () => {
    const key = provider === "gmail" ? googleSessionKey : sessionKeyFor;
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
    const pending =
      provider === "gmail"
        ? getGmailTokenForAccount("a", false)
        : renewGraphToken("a", "old", { clientId: "client" });
    const outcome = pending.then(
      (v) => ({ v }),
      (e) => ({ e }),
    );
    await started;
    if (provider === "gmail") await clearGmailToken(undefined, "a");
    else await clearGraphToken("a");
    resume();
    assert.ok((await outcome).e, "pending auth must reject");
    assert.equal(session.data[key("a")], undefined);
    assert.equal(session.data[key("b")].accessToken, "other");
    const silent =
      provider === "gmail"
        ? () => getGmailTokenForAccount("a", false)
        : () => getGraphTokenForAccount("a", false, { clientId: "client" });
    await assert.rejects(silent);
  });
test("Google account switch uses a registered web redirect and implicit token without token exchange", async () => {
  const session = store(),
    local = store();
  let authUrl;
  let requests = [];
  globalThis.chrome = {
    storage: { session, local },
    runtime: {
      getManifest: () => ({ oauth2: { client_id: "chrome-client" } }),
    },
    identity: {
      getAuthToken: (_d, cb) => cb(null),
      getRedirectURL: () => "https://extension.chromiumapp.org/",
      launchWebAuthFlow: ({ url }, cb) => {
        authUrl = new URL(url);
        cb(
          `https://extension.chromiumapp.org/#access_token=chosen&expires_in=3600&state=${authUrl.searchParams.get("state")}`,
        );
      },
    },
  };
  local.data.googleWebClientId = "web-client.apps.googleusercontent.com";
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return {
      ok: true,
      json: async () => ({ emailAddress: "switch@gmail.com" }),
    };
  };
  assert.equal(
    await getGmailTokenForAccount("switch@gmail.com", true),
    "chosen",
  );
  assert.equal(authUrl.searchParams.get("response_type"), "token");
  assert.equal(
    authUrl.searchParams.get("client_id"),
    "web-client.apps.googleusercontent.com",
  );
  assert.equal(requests.length, 1);
  assert.match(requests[0], /^https:\/\/gmail.googleapis.com\//);
});
for (const provider of ["gmail", "outlook"])
  test(`${provider} delayed storage write is followed by removal and cannot return a usable token`, async () => {
    const key = provider === "gmail" ? googleSessionKey : sessionKeyFor;
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
    const pending =
      provider === "gmail"
        ? getGmailTokenForAccount("a", false)
        : renewGraphToken("a", "old", { clientId: "client" });
    const outcome = pending.then(
      (v) => ({ v }),
      (e) => ({ e }),
    );
    await started;
    const clearing =
      provider === "gmail"
        ? clearGmailToken(undefined, "a")
        : clearGraphToken("a");
    finish();
    await clearing;
    assert.ok((await outcome).e);
    assert.equal(session.data[key("a")], undefined);
    assert.equal(session.data[key("b")].accessToken, "other");
  });
for (const provider of ["gmail", "outlook"])
  test(`${provider} per-account sign-out does not enumerate or remove legacy and other slots`, async () => {
    const key = provider === "gmail" ? googleSessionKey : sessionKeyFor;
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
    if (provider === "gmail") await clearGmailToken(undefined, "a");
    else await clearGraphToken("a");
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
