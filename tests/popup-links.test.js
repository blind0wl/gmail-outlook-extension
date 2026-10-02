import test from "node:test";
import assert from "node:assert";
import {
  gmailThreadUrl,
  outlookThreadUrl,
  threadUrl,
  messageIdOf,
} from "../src/popup/links.js";

test("gmail thread urls pin the mailbox with authuser email", () => {
  assert.equal(
    gmailThreadUrl("work@gmail.com", "abc"),
    "https://mail.google.com/mail/?authuser=work%40gmail.com#inbox/abc",
  );
  assert.equal(
    gmailThreadUrl("personal@gmail.com", "abc"),
    "https://mail.google.com/mail/?authuser=personal%40gmail.com#inbox/abc",
  );
});

test("gmail thread url falls back to slot-less url for unknown account", () => {
  assert.equal(
    gmailThreadUrl("", "abc"),
    "https://mail.google.com/mail/#inbox/abc",
  );
});

test("outlook thread urls address the mailbox per account", () => {
  assert.equal(
    outlookThreadUrl("you@outlook.com", "ABC123"),
    "https://outlook.live.com/mail/you%40outlook.com/inbox/id/ABC123",
  );
});

test("outlook thread url falls back to slot 0 without an account", () => {
  assert.equal(
    outlookThreadUrl("", "ABC123"),
    "https://outlook.live.com/mail/0/inbox/id/ABC123",
  );
});

test("every built link carries the account address", () => {
  const cases = [
    threadUrl({ key: "gmail:abc", provider: "gmail", account: "work@gmail.com" }),
    threadUrl({ key: "gmail:abc", provider: "gmail", account: "personal@gmail.com" }),
    threadUrl({ key: "outlook:A1", provider: "outlook", account: "you@outlook.com" }),
  ];
  assert.equal(
    cases.filter((url) => /work%40gmail\.com|personal%40gmail\.com|you%40outlook\.com/.test(url)).length,
    cases.length,
  );
});

test("messageIdOf strips the provider prefix", () => {
  assert.equal(messageIdOf("gmail:abc"), "abc");
  assert.equal(messageIdOf("outlook:A=B"), "A=B");
});

test('inbox links encode configured identities and reject missing or unknown accounts', async () => {
  const {accountInboxUrl} = await import('../src/popup/links.js');
  assert.equal(accountInboxUrl({provider:'gmail',account:'first+work@example.test'}),'https://mail.google.com/mail/?authuser=first%2Bwork%40example.test#inbox');
  assert.equal(accountInboxUrl({provider:'outlook',account:'second@example.test'}),'https://outlook.live.com/mail/0/inbox?login_hint=second%40example.test');
  for(const account of [null,{}, {provider:'other',account:'a@b.test'},{provider:'gmail',account:''}]) assert.equal(accountInboxUrl(account),null);
});
