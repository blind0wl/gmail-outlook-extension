import test from "node:test";
import assert from "node:assert";
import {
  normalizeGraphMessage,
  fetchOutlookMessages,
  OutlookFetchError,
} from "../src/providers/outlook.js";
import raw from "../tests/fixtures/graph-list.json" with { type: "json" };
test("graph normalize keeps provider key", () => {
  const out = normalizeGraphMessage(raw.value[0], "you@outlook.com");
  assert.equal(out.provider, "outlook");
  assert.equal(out.key, "outlook:" + raw.value[0].id);
});

test("graph normalize maps full cache shape", () => {
  const out = normalizeGraphMessage(raw.value[0], "you@outlook.com");
  assert.equal(out.account, "you@outlook.com");
  assert.equal(out.from, "alice@example.com");
  assert.equal(out.subject, "Quarterly report draft");
  assert.equal(out.snippet, raw.value[0].bodyPreview);
  assert.equal(out.date, Date.parse("2026-09-20T10:00:00Z"));
  assert.equal(out.unread, true);
  assert.equal(out.localRead, false);
  const read = normalizeGraphMessage(raw.value[1], "you@outlook.com");
  assert.equal(read.unread, false);
});

function stubFetch(handler) {
  const prev = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = prev;
  };
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const SECRET = raw.value[0].subject;

test("outlook fetch follows @odata.nextLink across two pages", async () => {
  const seen = [];
  const restore = stubFetch(async (url) => {
    seen.push(url);
    if (url.includes("/v1.0/me?$select=")) {
      return ok({ mail: "you@outlook.com" });
    }
    if (url.includes("@page2")) {
      return ok({ value: [raw.value[1]] });
    }
    return ok({
      value: [raw.value[0]],
      "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/messages?$top=1&@page2",
    });
  });
  try {
    const out = await fetchOutlookMessages("tok");
    assert.deepEqual(
      out.map((m) => m.key),
      ["outlook:" + raw.value[0].id, "outlook:" + raw.value[1].id],
    );
    assert.ok(out.every((m) => m.account === "you@outlook.com"));
    assert.ok(
      seen.some((u) => u.includes("@page2")),
      "second request follows nextLink",
    );
  } finally {
    restore();
  }
});

test("outlook fetch http failure is sanitized", async () => {
  const restore = stubFetch(async (url) => {
    if (url.includes("/v1.0/me?$select=")) return ok({ mail: "you@outlook.com" });
    return { ok: false, status: 503 };
  });
  try {
    await assert.rejects(() => fetchOutlookMessages("tok"), OutlookFetchError);
    const err = await fetchOutlookMessages("tok").catch((e) => e);
    assert.ok(err.message.includes("outlook list"));
    assert.ok(err.message.includes("503"));
    assert.ok(err.at, "timestamp present");
    assert.ok(!err.message.includes(SECRET), "no subject in error");
  } finally {
    restore();
  }
});

test("outlook fetch transport failure is sanitized", async () => {
  const restore = stubFetch(async (url) => {
    if (url.includes("/v1.0/me?$select=")) return ok({ mail: "you@outlook.com" });
    throw new TypeError("fetch failed");
  });
  try {
    const err = await fetchOutlookMessages("tok").catch((e) => e);
    assert.ok(err instanceof OutlookFetchError);
    assert.ok(err.message.includes("outlook list"));
    assert.ok(err.at, "timestamp present");
  } finally {
    restore();
  }
});

test("outlook fetch parse failure is sanitized", async () => {
  const restore = stubFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError("bad json");
    },
  }));
  try {
    const err = await fetchOutlookMessages("tok").catch((e) => e);
    assert.ok(err instanceof OutlookFetchError);
    assert.ok(err.message.includes("parse"));
    assert.ok(err.at, "timestamp present");
    assert.ok(!err.message.includes(SECRET), "no subject in error");
  } finally {
    restore();
  }
});
