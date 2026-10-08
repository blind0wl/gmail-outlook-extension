import test from "node:test";
import assert from "node:assert/strict";
import { processFreshMail } from "../src/auth-codes/pipeline.js";

const now = 1_800_000_000_000;

function mail(id, date, snippet) {
  return {
    key: `gmail:test:${id}`,
    provider: "gmail",
    account: "test@example.com",
    subject: "Your sign-in verification code",
    snippet,
    date,
  };
}

test("body-only detection follows the same code notification path", async () => {
  const item = mail("body", now, "Your sign-in code is in the full message.");
  const saved = [];
  const notifications = [];
  let fetched = 0;
  const result = await processFreshMail([item], {
    now,
    fetchBody: async () => { fetched++; return { ok: true, content: "Verification code: 052801" }; },
    saveCode: async (...record) => { saved.push(record); return true; },
    notifyCode: async (...args) => notifications.push(args),
    notifyMail: async () => assert.fail("detected code should not use a general mail toast"),
  });
  assert.equal(fetched, 1);
  assert.deepEqual(result.detected, [item.key]);
  assert.equal(saved[0][1], "052801");
  assert.equal(notifications.length, 1);
  assert.deepEqual(notifications[0][1], { copied: false, expiresAt: now + 10 * 60_000 });
  assert.equal(JSON.stringify(notifications).includes("052801"), false);
});

test("a second code in the full message prevents copy and falls back to mail alert", async () => {
  const item = mail("ambiguous-body", now, "The code is 083124.");
  const saves = [];
  const general = [];
  let copied = 0;
  const result = await processFreshMail([item], {
    now,
    autoCopy: true,
    fetchBody: async () => ({ ok: true, content: "Code 083124. The replacement code is 771026." }),
    saveCode: async (...args) => { saves.push(args); return true; },
    copyCode: async () => { copied++; return true; },
    notifyMail: async (items) => general.push(items),
  });
  assert.equal(copied, 0);
  assert.equal(saves.length, 0);
  assert.deepEqual(result.ordinary, [item.key]);
  assert.equal(general.length, 1);
});

test("an unavailable full body allows click-copy but suppresses automatic copy", async () => {
  const item = mail("fallback", now, "Code: 501923");
  const notices = [];
  let copied = 0;
  await processFreshMail([item], {
    now,
    autoCopy: true,
    fetchBody: async () => ({ ok: false }),
    saveCode: async () => true,
    copyCode: async () => { copied++; return true; },
    notifyCode: async (_item, result) => notices.push(result),
  });
  assert.equal(copied, 0);
  assert.deepEqual(notices, [{ copied: false, expiresAt: now + 10 * 60_000 }]);
});

test("auto-copy failure never reports ready-to-paste and the button remains available", async () => {
  const item = mail("copy-fails", now, "Code: 163208");
  const notices = [];
  const result = await processFreshMail([item], {
    now,
    autoCopy: true,
    fetchBody: async () => ({ ok: true, content: "Verification code is 163208." }),
    saveCode: async () => true,
    copyCode: async () => false,
    notifyCode: async (_item, notice) => notices.push(notice),
  });
  assert.equal(result.autoCopyAttempted, true);
  assert.deepEqual(notices, [{ copied: false, expiresAt: now + 10 * 60_000 }]);
});

test("a batch copies only its newest code and older notifications remain click-to-copy", async () => {
  const newest = mail("newest", now, "Code: 900111");
  const older = mail("older", now - 1_000, "Code: 800222");
  const copied = [];
  const notices = [];
  await processFreshMail([older, newest], {
    now,
    autoCopy: true,
    fetchBody: async (item) => ({ ok: true, content: item.snippet }),
    saveCode: async () => true,
    copyCode: async (code) => { copied.push(code); return true; },
    notifyCode: async (item, notice) => notices.push({ key: item.key, ...notice }),
  });
  assert.deepEqual(copied, ["900111"]);
  assert.equal(notices.find((notice) => notice.key === newest.key).copied, true);
  assert.equal(notices.find((notice) => notice.key === older.key).copied, false);
});

test("duplicate versions are suppressed while an updated Gmail thread can replace its code", async () => {
  const item = mail("thread", now, "Code: 100200");
  const seen = new Set();
  const notices = [];
  const saveCode = async (key, code, _expires, _now, version) => {
    const marker = `${key}:${version}`;
    if (seen.has(marker)) return false;
    seen.add(marker);
    return true;
  };
  const deps = {
    now,
    saveCode,
    notifyCode: async (_item, notice) => notices.push(notice),
  };
  await processFreshMail([item], deps);
  await processFreshMail([item], deps);
  const update = { ...item, date: now + 1_000, snippet: "Code: 900321" };
  await processFreshMail([update], { ...deps, now: now + 1_000 });
  assert.equal(notices.length, 2);
});
