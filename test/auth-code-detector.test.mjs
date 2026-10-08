import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_CODE_TTL_MS,
  AUTH_MESSAGE_MAX_AGE_MS,
  authCodeExpiresAt,
  detectAuthCode,
} from "../src/auth-codes/detector.js";

const now = 1_800_000_000_000;
const message = (subject, snippet, date = now) => ({ subject, snippet, date });

test("detects numeric codes and preserves leading zeroes", () => {
  assert.deepEqual(
    detectAuthCode(message("Sign-in verification code", "Use code 004271 to continue."), { now }),
    { status: "code", authLike: true, code: "004271", date: now },
  );
});

test("detects mixed alphanumeric codes without changing their case", () => {
  const result = detectAuthCode(message("Your login passcode", "Enter aBc123 now."), { now });
  assert.equal(result.status, "code");
  assert.equal(result.code, "aBc123");
});

test("refuses multiple candidates in one authentication email", () => {
  const result = detectAuthCode(message(
    "Sign-in code",
    "Your code is 123456 and the replacement verification code is 739204.",
  ), { now });
  assert.equal(result.status, "ambiguous");
  assert.equal("code" in result, false);
});

test("does not copy security bulletins, IP suffixes, discount codes, or order codes", () => {
  const cases = [
    message("Security bulletin: CVE-2026-123456", "Review the vulnerability advisory."),
    message("Login confirmed", "New location IP 192.168.1.1234 was used."),
    message("Security sale", "Use discount code SAVE20 today."),
    message("Order update", "Your order code is 839204."),
  ];
  for (const item of cases) {
    assert.notEqual(detectAuthCode(item, { now }).status, "code", item.subject);
  }
});

test("uses the full message for body-only codes and rejects body ambiguity", () => {
  const item = message("Your sign-in code", "Open the full message to view the code.");
  assert.equal(detectAuthCode(item, { now }).status, "none");
  assert.equal(detectAuthCode(item, {
    now,
    body: "Enter verification code <b>784201</b> to sign in.",
    contentType: "html",
  }).code, "784201");
  assert.equal(detectAuthCode(item, {
    now,
    body: "Code 784201 was replaced by code 227154.",
  }).status, "ambiguous");
});

test("rejects old, missing, and implausibly future message dates", () => {
  const old = detectAuthCode(message("Sign-in code", "Code: 123456", now - AUTH_MESSAGE_MAX_AGE_MS - 1), { now });
  assert.equal(old.status, "expired");
  assert.equal(detectAuthCode({ subject: "Sign-in code", snippet: "Code: 123456" }, { now }).status, "expired");
  assert.equal(detectAuthCode(message("Sign-in code", "Code: 123456", now + 6 * 60_000), { now }).status, "expired");
});

test("pending expiry is bounded by receipt time", () => {
  assert.equal(authCodeExpiresAt(now, now), now + AUTH_CODE_TTL_MS);
  assert.equal(authCodeExpiresAt(now - 9 * 60_000, now), now + 60_000);
  assert.equal(authCodeExpiresAt(undefined, now), now);
});
