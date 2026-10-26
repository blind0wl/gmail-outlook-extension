import test from "node:test";
import assert from "node:assert/strict";

const ACCOUNT = "reader@example.com";
const THREAD = "a1b2c3d4";
const SESSION_KEY = "session-key";

function feedXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><feed version="0.3" xmlns="http://purl.org/atom/ns#"><title>Gmail - Inbox for ${ACCOUNT}</title><fullcount>1</fullcount></feed>`;
}

function conversationJson() {
  const summary = Array(9).fill(null);
  summary[0] = "cs";
  summary[1] = THREAD;
  summary[2] = THREAD;
  summary[3] = 1;
  summary[8] = [THREAD];
  const member = Array(14).fill(null);
  member[0] = "ms";
  member[1] = THREAD;
  member[9] = ["^i"];
  member[13] = Array(7).fill(null);
  member[13][6] = "<p>Verification code: 123456</p>";
  return JSON.stringify([[summary, member], "unused"]);
}

function response(text, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    type: "basic",
    async text() { return text; },
  };
}

test("gmail body reads reuse a verified session and skip the duplicate ownership feed", async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    urls.push(parsed.pathname + parsed.search);
    if (parsed.pathname.endsWith("/feed/atom")) return response(feedXml());
    if (parsed.search) return response(conversationJson());
    return response(`<script>var GM_ID_KEY = "${SESSION_KEY}";</script>`);
  };
  globalThis.chrome = {
    cookies: { async get() { return { value: "csrf" }; } },
  };

  const { gmailReadSession, clearGmailSessionCache } = await import("../src/providers/mail-actions.js");
  const { readGmailMessageBody } = await import("../src/providers/gmail-conversation-state.js");
  clearGmailSessionCache();

  const cold = await gmailReadSession(ACCOUNT);
  const afterSession = urls.length;
  const first = await readGmailMessageBody(ACCOUNT, cold, THREAD);
  const afterFirstBody = urls.length;
  const warm = await gmailReadSession(ACCOUNT);
  const afterWarmSession = urls.length;
  const second = await readGmailMessageBody(ACCOUNT, warm, THREAD);
  const afterSecondBody = urls.length;

  assert.equal(first.recognized, true);
  assert.equal(second.recognized, true);
  assert.equal(afterSession, 3, "cold session resolves the slot, base key and one ownership check");
  assert.equal(afterFirstBody, 4, "a body read adds only the conversation request");
  assert.equal(afterWarmSession, 4, "a second read reuses the cached session");
  assert.equal(afterSecondBody, 5, "a second body read adds only its conversation request");
});
