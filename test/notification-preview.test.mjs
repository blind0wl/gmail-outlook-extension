import test from "node:test";
import assert from "node:assert/strict";
import { buildToast } from "../src/notify/notify.js";

test("mail notifications include sender and four preview lines without injected layout", () => {
  const toast = buildToast({
    account: "preview@example.com", provider: "gmail",
    items: [{ subject: "Meeting\nupdate", from: "Alex\r\nSmith", snippet: "Please review the updated agenda and send your feedback before tomorrow. ".repeat(8) }],
  });
  const lines = toast.message.split("\n");
  assert.equal(lines.length, 6);
  assert.equal(lines[0], "Meeting update");
  assert.equal(lines[1], "From: Alex Smith");
  assert.ok(lines.slice(2).every(line => line.length <= 65));
  assert.ok(lines[5].endsWith("…"));
});

test("grouped mail keeps the count and latest context, with graceful missing fields", () => {
  const group = { account: "preview@example.com", provider: "outlook", items: [{ subject: "Latest", snippet: "Short preview" }, { subject: "Older" }] };
  assert.equal(buildToast(group).message, "2 new messages — latest: Latest\nShort preview");
  assert.equal(buildToast({ ...group, items: [{}] }).message, "(no subject)");
});
