import test from "node:test";
import assert from "node:assert";
import {
  normalizeGmailMessage,
  fetchGmailMessages,
  GmailFetchError,
} from "../src/providers/gmail.js";
import raw from "../tests/fixtures/gmail-list.json" with { type: "json" };
test("gmail normalize keeps account and key", () => {
  const out = normalizeGmailMessage(raw.messages[0], "work@gmail.com");
  assert.equal(out.key, "gmail:" + raw.messages[0].id);
  assert.equal(out.account, "work@gmail.com");
});

function stubFetch(handler) {
  const prev = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = prev;
  };
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const SECRET = raw.messages[0].payload.headers.find(
  (h) => h.name === "Subject",
).value;

test("gmail fetch follows nextPageToken across two pages", async () => {
  const seen = [];
  const restore = stubFetch(async (url) => {
    seen.push(url);
    if (url.endsWith("/profile")) return ok({ emailAddress: "work@gmail.com" });
    if (url.includes("/messages?")) {
      if (url.includes("pageToken=")) return ok({ messages: [{ id: raw.messages[1].id }] });
      return ok({
        messages: [{ id: raw.messages[0].id }],
        nextPageToken: "tok2",
      });
    }
    return ok(raw.messages.find((m) => url.includes(m.id)));
  });
  try {
    const out = await fetchGmailMessages("tok", Date.now());
    assert.deepEqual(
      out.map((m) => m.key),
      ["gmail:" + raw.messages[0].id, "gmail:" + raw.messages[1].id],
    );
    assert.ok(out.every((m) => m.account === "work@gmail.com"));
    assert.ok(
      seen.some((u) => decodeURIComponent(u).includes("pageToken=tok2")),
      "second list request carries pageToken",
    );
  } finally {
    restore();
  }
});

test("gmail fetch http failure is sanitized", async () => {
  const restore = stubFetch(async () => ({ ok: false, status: 503 }));
  try {
    await assert.rejects(() => fetchGmailMessages("tok"), GmailFetchError);
    const err = await fetchGmailMessages("tok").catch((e) => e);
    assert.ok(err.message.includes("gmail list"));
    assert.ok(err.message.includes("503"));
    assert.ok(err.at, "timestamp present");
    assert.ok(!err.message.includes(SECRET), "no subject in error");
    assert.equal(err.id, undefined);
  } finally {
    restore();
  }
});

test("gmail fetch transport failure is sanitized", async () => {
  const restore = stubFetch(async () => {
    throw new TypeError("fetch failed");
  });
  try {
    const err = await fetchGmailMessages("tok").catch((e) => e);
    assert.ok(err instanceof GmailFetchError);
    assert.ok(err.message.includes("gmail list"));
    assert.ok(err.at, "timestamp present");
  } finally {
    restore();
  }
});

test("gmail fetch parse failure is sanitized", async () => {
  const restore = stubFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError("bad json");
    },
  }));
  try {
    const err = await fetchGmailMessages("tok").catch((e) => e);
    assert.ok(err instanceof GmailFetchError);
    assert.ok(err.message.includes("parse"));
    assert.ok(err.at, "timestamp present");
  } finally {
    restore();
  }
});

test("gmail get failure carries id and account, never content", async () => {
  const restore = stubFetch(async (url) => {
    if (url.endsWith("/profile")) return ok({ emailAddress: "work@gmail.com" });
    if (url.includes("/messages?")) return ok({ messages: [{ id: raw.messages[0].id }] });
    return { ok: false, status: 500 };
  });
  try {
    const err = await fetchGmailMessages("tok").catch((e) => e);
    assert.ok(err instanceof GmailFetchError);
    assert.equal(err.id, raw.messages[0].id);
    assert.equal(err.account, "work@gmail.com");
    assert.ok(err.message.includes(raw.messages[0].id));
    assert.ok(!err.message.includes(SECRET), "no subject in error");
    assert.ok(
      !err.message.includes(raw.messages[0].snippet),
      "no snippet in error",
    );
  } finally {
    restore();
  }
});
