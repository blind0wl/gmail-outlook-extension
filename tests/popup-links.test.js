import test from "node:test";
import assert from "node:assert";
import {
  gmailThreadUrl,
  outlookThreadUrl,
  threadUrl,
  searchUrl,
  outlookSearchUrl,
  gmailSearchUrl,
  isCardSelfKeydown,
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
    outlookSearchUrl("you@outlook.com"),
    searchUrl("outlook", "you@outlook.com"),
    searchUrl("gmail", "work@gmail.com"),
  ];
  assert.equal(
    cases.filter((url) => /work%40gmail\.com|personal%40gmail\.com|you%40outlook\.com/.test(url)).length,
    cases.length,
  );
});

test("search follows the active filter with account-aware views", () => {
  assert.equal(
    gmailSearchUrl("work@gmail.com"),
    "https://mail.google.com/mail/?authuser=work%40gmail.com#search/in%3Ainbox",
  );
  assert.equal(
    gmailSearchUrl(""),
    "https://mail.google.com/mail/#search/in%3Ainbox",
  );
  assert.equal(searchUrl("all", "work@gmail.com"), gmailSearchUrl("work@gmail.com"));
  assert.equal(searchUrl("gmail", "work@gmail.com"), gmailSearchUrl("work@gmail.com"));
  assert.equal(
    searchUrl("outlook", "you@outlook.com"),
    "https://outlook.live.com/mail/you%40outlook.com/search",
  );
  assert.equal(searchUrl("outlook", ""), "https://outlook.live.com/mail/0/search");
});

test("messageIdOf strips the provider prefix", () => {
  assert.equal(messageIdOf("gmail:abc"), "abc");
  assert.equal(messageIdOf("outlook:A=B"), "A=B");
});

test("card keys mark read only when targeted at the card itself", () => {
  const card = { id: "card" };
  const button = { id: "open" };
  // Enter/Space on the focused card: handler runs, marks read.
  assert.equal(isCardSelfKeydown({ key: "Enter", target: card, currentTarget: card }), true);
  assert.equal(isCardSelfKeydown({ key: " ", target: card, currentTarget: card }), true);
  // Enter/Space bubbled from the nested Open button: handler ignores, so
  // the button keeps native activation and still opens the thread.
  assert.equal(isCardSelfKeydown({ key: "Enter", target: button, currentTarget: card }), false);
  assert.equal(isCardSelfKeydown({ key: " ", target: button, currentTarget: card }), false);
  // Other keys never mark read wherever they land.
  assert.equal(isCardSelfKeydown({ key: "a", target: card, currentTarget: card }), false);
  assert.equal(isCardSelfKeydown({ key: "Tab", target: card, currentTarget: card }), false);
});
