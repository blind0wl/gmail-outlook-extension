import test from "node:test";
import assert from "node:assert";
import {
  gmailAccountOrder,
  gmailThreadUrl,
  outlookThreadUrl,
  threadUrl,
  searchUrl,
  messageIdOf,
  GMAIL_SEARCH_URL,
  OUTLOOK_SEARCH_URL,
} from "../src/popup/links.js";

const GMAIL_ACCOUNTS = ["work@gmail.com", "personal@gmail.com"];

test("gmail thread urls carry the authuser slot per configured account", () => {
  assert.equal(
    gmailThreadUrl("work@gmail.com", "abc", GMAIL_ACCOUNTS),
    "https://mail.google.com/mail/u/0/#inbox/abc",
  );
  assert.equal(
    gmailThreadUrl("personal@gmail.com", "abc", GMAIL_ACCOUNTS),
    "https://mail.google.com/mail/u/1/#inbox/abc",
  );
});

test("gmail thread url falls back to slot-less url for unknown account", () => {
  assert.equal(
    gmailThreadUrl("other@gmail.com", "abc", GMAIL_ACCOUNTS),
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

test("threadUrl keys off provider plus id and routes per account", () => {
  assert.equal(
    threadUrl(
      { key: "gmail:abc", provider: "gmail", account: "personal@gmail.com" },
      GMAIL_ACCOUNTS,
    ),
    "https://mail.google.com/mail/u/1/#inbox/abc",
  );
  assert.equal(
    threadUrl(
      { key: "outlook:ABC123", provider: "outlook", account: "you@outlook.com" },
      GMAIL_ACCOUNTS,
    ),
    "https://outlook.live.com/mail/you%40outlook.com/inbox/id/ABC123",
  );
});

test("gmailAccountOrder keeps configured gmail order only", () => {
  assert.deepEqual(
    gmailAccountOrder([
      { provider: "outlook", account: "you@outlook.com" },
      { provider: "gmail", account: "work@gmail.com" },
      { provider: "gmail", account: "personal@gmail.com" },
    ]),
    GMAIL_ACCOUNTS,
  );
});

test("search follows the active filter", () => {
  assert.equal(searchUrl("all"), GMAIL_SEARCH_URL);
  assert.equal(searchUrl("gmail"), GMAIL_SEARCH_URL);
  assert.equal(searchUrl("outlook"), OUTLOOK_SEARCH_URL);
  assert.ok(OUTLOOK_SEARCH_URL.endsWith("/mail/0/search"));
});

test("messageIdOf strips the provider prefix", () => {
  assert.equal(messageIdOf("gmail:abc"), "abc");
  assert.equal(messageIdOf("outlook:A=B"), "A=B");
});
