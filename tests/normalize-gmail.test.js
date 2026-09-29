import test from "node:test";
import assert from "node:assert";
import {
  normalizeGmailMessage,
  parseFeed,
  fetchGmailMessages,
  GmailFetchError,
} from "../src/providers/gmail.js";

const SECRET = "Q3 report supersecret";

function feedXml(account, entries) {
  return `<?xml version="1.0" encoding="UTF-8" ?>
<feed version="0.3" xmlns="http://purl.org/atom/ns#">
<title>Gmail - Inbox for ${account}</title>
<fullcount>${entries.length}</fullcount>
${entries
  .map(
    (e) => `<entry><title>${e.subject}</title><summary>${e.snippet}</summary>
<link rel="alternate" type="text/html" href="https://mail.google.com/mail/u/0/#inbox/${e.id}"/>
<issued>${e.date}</issued>
<author><name>${e.from}</name><email>${e.fromMail}</email></author></entry>`,
  )
  .join("\n")}
</feed>`;
}

const WORK = {
  id: "1901a2b3c4d5",
  from: "alice",
  fromMail: "alice@example.com",
  subject: "Q3 report supersecret",
  snippet: "Quarterly report is attached for review.",
  date: "2024-09-27T09:00:00Z",
};

test("gmail normalize keeps account and key", () => {
  const out = normalizeGmailMessage(
    {
      id: WORK.id,
      from: "alice@example.com",
      subject: WORK.subject,
      snippet: WORK.snippet,
      date: Date.parse(WORK.date),
    },
    "work@gmail.com",
  );
  assert.equal(out.key, "gmail:work%40gmail.com:" + WORK.id);
  assert.equal(out.account, "work@gmail.com");
  assert.equal(out.unread, true);
});

function stubFetch(handler) {
  const prev = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = prev;
  };
}

const ok = (body) => ({ ok: true, status: 200, text: async () => body });

test("gmail fetch discovers slots and stops at 404", async () => {
  const seen = [];
  const restore = stubFetch(async (url, init) => {
    seen.push(url);
    assert.equal(init?.credentials, "include");
    if (url.includes("/u/0/")) return ok(feedXml("work@gmail.com", [WORK]));
    if (url.includes("/u/1/"))
      return ok(
        feedXml("personal@gmail.com", [{ ...WORK, id: "aaaabbbbcccc" }]),
      );
    return { ok: false, status: 404, text: async () => "" };
  });
  try {
    const out = await fetchGmailMessages(null, 0);
    assert.deepEqual(
      out.map((m) => m.key),
      [
        "gmail:work%40gmail.com:" + WORK.id,
        "gmail:personal%40gmail.com:aaaabbbbcccc",
      ],
    );
    assert.equal(out.complete, true);
    assert.equal(out.totalUnread, 2);
    assert.ok(!seen.some((u) => u.includes("/u/3/")), "stops after first 404");
  } finally {
    restore();
  }
});

test("gmail slot 0 without session throws feed-auth", async () => {
  const restore = stubFetch(async () => ({ ok: false, status: 401 }));
  try {
    const err = await fetchGmailMessages(null).catch((e) => e);
    assert.ok(err instanceof GmailFetchError);
    assert.ok(err.message.includes("feed-auth"));
    assert.ok(err.at, "timestamp present");
  } finally {
    restore();
  }
});

test("gmail login page body throws feed-auth without content", async () => {
  const restore = stubFetch(async () => ({
    ok: true,
    status: 200,
    text: async () => `<HTML><TITLE>Sign in - Google Accounts ${SECRET}</TITLE></HTML>`,
  }));
  try {
    const err = await fetchGmailMessages(null).catch((e) => e);
    assert.ok(err instanceof GmailFetchError);
    assert.ok(!err.message.includes(SECRET), "no page content in error");
  } finally {
    restore();
  }
});

test("gmail transport failure is sanitized", async () => {
  const restore = stubFetch(async () => {
    throw new TypeError("fetch failed");
  });
  try {
    const err = await fetchGmailMessages(null).catch((e) => e);
    assert.ok(err instanceof GmailFetchError);
    assert.ok(err.message.includes("gmail feed"));
    assert.ok(err.at, "timestamp present");
  } finally {
    restore();
  }
});

test("gmail since filters old entries", async () => {
  const restore = stubFetch(async (url) => {
    if (url.includes("/u/0/")) return ok(feedXml("work@gmail.com", [WORK]));
    return { ok: false, status: 404, text: async () => "" };
  });
  try {
    const out = await fetchGmailMessages(null, Date.parse("2024-09-28T00:00:00Z"));
    assert.equal(out.length, 0);
    assert.equal(out.complete, true);
  } finally {
    restore();
  }
});

test("parseFeed decodes entities and skips id-less entries", () => {
  const xml = feedXml("work@gmail.com", [
    { ...WORK, subject: "Fish &amp; Chips" },
  ]).replace(/#inbox\/[0-9a-f]+/, "#inbox/");
  const parsed = parseFeed(xml, 0);
  assert.equal(parsed.entries.length, 0);
  const parsed2 = parseFeed(feedXml("work@gmail.com", [WORK]), 0);
  assert.equal(parsed2.account, "work@gmail.com");
  assert.equal(parsed2.entries[0].subject, WORK.subject);
});
