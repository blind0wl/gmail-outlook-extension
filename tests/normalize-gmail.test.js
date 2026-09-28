import test from "node:test";
import assert from "node:assert";
import { normalizeGmailMessage } from "../src/providers/gmail.js";
import raw from "../tests/fixtures/gmail-list.json" with { type: "json" };
test("gmail normalize keeps account and key", () => {
  const out = normalizeGmailMessage(raw.messages[0], "work@gmail.com");
  assert.equal(out.key, "gmail:" + raw.messages[0].id);
  assert.equal(out.account, "work@gmail.com");
});
