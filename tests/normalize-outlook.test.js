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
  assert.equal(out.key, "outlook:you%40outlook.com:" + raw.value[0].id);
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

// Fails the test if a sensitive string appears anywhere observable on the
// error: the message, its string coercion, or its serialized properties.
function assertNoLeak(err, secret) {
  assert.ok(!err.message.includes(secret), "no secret in message");
  assert.ok(!String(err).includes(secret), "no secret in String(err)");
  assert.ok(
    !JSON.stringify({ ...err, message: err.message }).includes(secret),
    "no secret in serialized properties",
  );
}

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
      ["outlook:you%40outlook.com:" + raw.value[0].id, "outlook:you%40outlook.com:" + raw.value[1].id],
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

test("outlook fetch rejects external @odata.nextLink before requesting it", async () => {
  const seen = [];
  const evil = "https://evil.example/collect?token=abc";
  const restore = stubFetch(async (url) => {
    seen.push(url);
    if (url.includes("/v1.0/me?$select=")) return ok({ mail: "you@outlook.com" });
    return ok({ value: [raw.value[0]], "@odata.nextLink": evil });
  });
  try {
    const err = await fetchOutlookMessages("tok").catch((e) => e);
    assert.ok(err instanceof OutlookFetchError);
    assert.ok(
      seen.every((u) => !u.startsWith("https://evil.example")),
      "no request sent to the external link",
    );
    assert.equal(err.account, "you@outlook.com");
    assert.ok(!err.message.includes("evil.example"), "no link in error");
  } finally {
    restore();
  }
});

test("outlook fetch refuses cross-origin redirect without following it", async () => {
  const seen = [];
  const restore = stubFetch(async (url) => {
    seen.push(url);
    if (url.includes("/v1.0/me?$select=")) return ok({ mail: "you@outlook.com" });
    return {
      ok: false,
      status: 301,
      headers: { get: () => "https://evil.example/steal" },
    };
  });
  try {
    const err = await fetchOutlookMessages("tok").catch((e) => e);
    assert.ok(err instanceof OutlookFetchError);
    assert.equal(seen.length, 2, "profile plus one list request, then stop");
    assert.ok(
      seen.every((u) => !u.startsWith("https://evil.example")),
      "redirect target never requested",
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

test("outlook network-down splits from abort: offline op versus transient", async () => {
  let mode = "down";
  const restore = stubFetch(async (url) => {
    if (url.includes("/v1.0/me?$select=")) return ok({ mail: "you@outlook.com" });
    if (mode === "abort") {
      const e = new Error("aborted");
      e.name = "TimeoutError";
      throw e;
    }
    throw new TypeError("fetch failed");
  });
  try {
    const down = await fetchOutlookMessages("tok").catch((e) => e);
    assert.ok(down instanceof OutlookFetchError);
    assert.equal(down.op, "list-offline");
    mode = "abort";
    const slow = await fetchOutlookMessages("tok").catch((e) => e);
    assert.ok(slow instanceof OutlookFetchError);
    assert.equal(slow.op, "list");
  } finally {
    restore();
  }
});

test("outlook fetch transport failure is sanitized", async () => {
  const secret = "TRANSPORT-SENSITIVE-7734 subject Quarterly report draft";
  const restore = stubFetch(async (url) => {
    if (url.includes("/v1.0/me?$select=")) return ok({ mail: "you@outlook.com" });
    throw new TypeError(secret);
  });
  try {
    const err = await fetchOutlookMessages("tok").catch((e) => e);
    assert.ok(err instanceof OutlookFetchError);
    assert.ok(err.message.includes("outlook list"));
    assert.ok(err.at, "timestamp present");
    assertNoLeak(err, secret);
    assertNoLeak(err, "Quarterly report draft");
  } finally {
    restore();
  }
});

test("outlook fetch parse failure is sanitized", async () => {
  const secret = "PARSE-SENSITIVE-9912 bodyPreview lunch tomorrow";
  const restore = stubFetch(async (url) => {
    if (url.includes("/v1.0/me?$select=")) return ok({ mail: "you@outlook.com" });
    return {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError(secret);
      },
    };
  });
  try {
    const err = await fetchOutlookMessages("tok").catch((e) => e);
    assert.ok(err instanceof OutlookFetchError);
    assert.ok(err.message.includes("parse"));
    assert.ok(err.at, "timestamp present");
    assertNoLeak(err, secret);
    assertNoLeak(err, "lunch tomorrow");
    assert.ok(!err.message.includes(SECRET), "no subject in error");
  } finally {
    restore();
  }
});
