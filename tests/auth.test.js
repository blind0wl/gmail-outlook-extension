// Auth static asserts (Task 6). No live OAuth, no network, no tokens.
// Asserts scope strings, authority, redirect shape, and public-client
// posture only.

import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { GMAIL_SCOPE, GMAIL_SCOPES } from "../src/auth/google.js";
import {
  MS_AUTHORITY,
  MS_SCOPES,
  MS_SESSION_KEY,
  buildAuthorizeUrl,
  parseAuthCallback,
  scopeString,
  isFresh,
  getRedirectUri,
  generatePkce,
} from "../src/auth/microsoft.js";
import manifest from "../manifest.json" with { type: "json" };

test("gmail scope is readonly only", () => {
  assert.equal(GMAIL_SCOPE, "https://www.googleapis.com/auth/gmail.readonly");
  assert.deepEqual(GMAIL_SCOPES, [GMAIL_SCOPE]);
});

test("manifest oauth2.scopes holds gmail.readonly only", () => {
  assert.deepEqual(manifest.oauth2?.scopes, [
    "https://www.googleapis.com/auth/gmail.readonly",
  ]);
});

test("microsoft authority is consumers only", () => {
  assert.equal(MS_AUTHORITY, "https://login.microsoftonline.com/consumers");
});

test("microsoft scopes are least privilege", () => {
  assert.deepEqual([...MS_SCOPES].sort(), ["Mail.Read", "User.Read", "offline_access"].sort());
  assert.equal(scopeString(), "User.Read Mail.Read offline_access");
  for (const banned of ["Mail.Read.Shared", "Mail.Send", "Mail.ReadWrite"]) {
    assert.ok(!MS_SCOPES.includes(banned), `must not request ${banned}`);
  }
});

test("authorize url uses consumers authority with PKCE S256 and no secret", () => {
  const url = buildAuthorizeUrl({
    clientId: "public-client-id",
    redirectUri: "https://abcdef.chromiumapp.org/",
    codeChallenge: "challenge-value",
    state: "state-value",
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, `${MS_AUTHORITY}/oauth2/v2.0/authorize`);
  assert.equal(parsed.searchParams.get("client_id"), "public-client-id");
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
  assert.equal(parsed.searchParams.get("code_challenge"), "challenge-value");
  assert.ok(parsed.searchParams.get("scope").includes("Mail.Read"));
  assert.ok(parsed.searchParams.get("scope").includes("offline_access"));
  assert.equal(parsed.searchParams.get("client_secret"), null);
  assert.ok(!url.includes("secret"));
});

test("callback parsing accepts code and rejects errors", () => {
  const code = parseAuthCallback(
    "https://abcdef.chromiumapp.org/?code=auth-code&state=s1",
    "s1",
  );
  assert.equal(code, "auth-code");
  assert.throws(() =>
    parseAuthCallback("https://abcdef.chromiumapp.org/?code=x&state=s2", "s1"),
  );
  assert.throws(() =>
    parseAuthCallback("https://abcdef.chromiumapp.org/?error=access_denied&state=s1", "s1"),
  );
  assert.throws(() => parseAuthCallback("https://abcdef.chromiumapp.org/?state=s1", "s1"));
});

test("redirect comes from chrome.identity.getRedirectURL shape", () => {
  const prev = globalThis.chrome;
  globalThis.chrome = {
    identity: { getRedirectURL: () => "https://abcdef.chromiumapp.org/" },
  };
  try {
    const uri = getRedirectUri();
    assert.match(uri, /^https:\/\/[a-z0-9]+\.chromiumapp\.org\/?/);
  } finally {
    globalThis.chrome = prev;
  }
});

test("pkce pair shape is S256-ready", async () => {
  const { verifier, challenge } = await generatePkce();
  assert.ok(verifier.length >= 43 && verifier.length <= 128);
  assert.ok(challenge.length > 0);
  assert.notEqual(verifier, challenge);
  assert.ok(!verifier.includes("+") && !verifier.includes("/") && !verifier.includes("="));
});

test("session posture: tokens keyed in session storage, freshness with skew", () => {
  assert.equal(MS_SESSION_KEY, "auth.microsoft.graph");
  const now = Date.now();
  assert.equal(isFresh({ accessToken: "t", expiresAt: now + 10 * 60_000 }, now), true);
  assert.equal(isFresh({ accessToken: "t", expiresAt: now + 30_000 }, now), false);
  assert.equal(isFresh(null, now), false);
});

test("bundle posture: public client, no secrets, no overbroad scopes", () => {
  const googleSrc = readFileSync(new URL("../src/auth/google.js", import.meta.url), "utf8");
  const msSrc = readFileSync(new URL("../src/auth/microsoft.js", import.meta.url), "utf8");
  const manifestSrc = readFileSync(new URL("../manifest.json", import.meta.url), "utf8");
  const bundle = googleSrc + msSrc + manifestSrc;
  assert.ok(!/client_secret\s*[=:]\s*["'][^"']+["']/i.test(bundle), "no secret value in bundle");
  for (const line of bundle.split("\n")) {
    if (/Mail\.Read\.Shared/.test(line)) {
      assert.ok(/never/i.test(line), `shared-scope mention must be a never-request caution: ${line.trim()}`);
    }
  }
  assert.ok(!/gmail\.(send|modify|compose)/i.test(bundle), "no gmail write scope");
  assert.ok(!/Mail\.Send|Mail\.ReadWrite/i.test(bundle), "no graph write scope");
  assert.ok(googleSrc.includes("getAuthToken"), "google uses getAuthToken");
  assert.ok(googleSrc.includes("removeCachedAuthToken"), "google clears cached token");
  assert.ok(msSrc.includes("launchWebAuthFlow"), "microsoft uses launchWebAuthFlow");
  assert.ok(msSrc.includes("getRedirectURL"), "redirect from chrome.identity");
  assert.ok(msSrc.includes("code_challenge_method"), "PKCE challenge method present");
});
