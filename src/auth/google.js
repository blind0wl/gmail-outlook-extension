import {
  capture,
  assertCurrent,
  invalidate,
  sessionOp,
  checkSignedOut,
  markSignedOut,
} from "./session-guard.js";
// Google auth for Gmail read-only access.
//
// Uses chrome.identity.getAuthToken (Chrome manages the OAuth dance against
// the client id pinned in manifest.json oauth2 section). Clearing uses
// chrome.identity.removeCachedAuthToken. Account-bound credentials stay in
// session storage; Chrome manages renewal of its own credentials.

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

// Single-element array so tests and the manifest can share one source of
// truth. Manifest oauth2.scopes must stay exactly this scope.
export const GMAIL_SCOPES = [GMAIL_SCOPE];

function identity() {
  return globalThis.chrome?.identity;
}

// Interactive sign in. Pass interactive=false for the silent refresh path
// (worker calls this after a 401): resolves with a token or rejects.
export function getGmailToken(interactive = true) {
  return new Promise((resolve, reject) => {
    const id = identity();
    if (!id?.getAuthToken) {
      reject(new Error("google auth unavailable: chrome.identity missing"));
      return;
    }
    try {
      id.getAuthToken({ interactive }, (token) => {
        const err =
          globalThis.chrome?.runtime?.lastError ?? id.lastError ?? null;
        if (err || !token) {
          reject(
            new Error(`google auth failed at=${new Date().toISOString()}`),
          );
          return;
        }
        resolve(token);
      });
    } catch {
      reject(new Error(`google auth threw at=${new Date().toISOString()}`));
    }
  });
}

// Single-token Chrome cache eviction, for renewal paths. Removes only
// the given token: other accounts' slots and credentials are untouched.
// Resolves true when evicted, false when there was nothing to evict, and
// rejects with a sanitized error when eviction itself fails.
export function evictGmailToken(token) {
  return new Promise((resolve, reject) => {
    const id = identity();
    if (!id?.removeCachedAuthToken || !token) {
      resolve(false);
      return;
    }
    try {
      id.removeCachedAuthToken({ token }, () => {
        const err = globalThis.chrome?.runtime?.lastError ?? null;
        if (err) {
          reject(
            new Error(`google sign out failed at=${new Date().toISOString()}`),
          );
          return;
        }
        resolve(true);
      });
    } catch {
      reject(new Error(`google sign out threw at=${new Date().toISOString()}`));
    }
  });
}

// Sign out helper. Removes every per-account session slot this extension
// writes plus one token from Chrome's cache; callers clear each token they
// hold. Resolves true when anything was removed, false when there was
// nothing to remove (no token, no slots, or no chrome.identity), and
// rejects with a sanitized error when removal itself fails — including
// when slot enumeration fails, since slots may then remain usable and the
// caller must report incomplete sign-out. Previously acquired credentials
// stay unusable: slots are gone and the Chrome token is evicted.
export async function clearGmailToken(token, account) {
  const guardKey = account === undefined ? "gmail" : `gmail:${account}`;
  invalidate(guardKey);
  return sessionOp(async () => {
    if (account !== undefined) {
      await markSignedOut(guardKey, true);
      const store = globalThis.chrome?.storage?.session;
      if (!store?.get || !store?.remove)
        throw new Error("google sign out failed");
      const record = (await store.get(googleSessionKey(account)))?.[
        googleSessionKey(account)
      ];
      if (record?.accessToken) await evictGmailToken(record.accessToken);
      await store.remove(googleSessionKey(account));
      if (token && token !== record?.accessToken) await evictGmailToken(token);
      return true;
    }
    let cleared = false;
    const store = globalThis.chrome?.storage?.session;
    if (store) {
      // Without get there is no way to enumerate slots that may remain
      // usable: report incomplete sign-out instead of blind success.
      if (typeof store.get !== "function") {
        throw new Error(
          `google sign out failed at=${new Date().toISOString()}`,
        );
      }
      let keys;
      try {
        // get(null) returns every key in the area.
        const all = await store.get(null);
        keys =
          all && typeof all === "object"
            ? Object.keys(all).filter((k) => k.startsWith(googleSessionKey("")))
            : [];
      } catch {
        throw new Error(
          `google sign out failed at=${new Date().toISOString()}`,
        );
      }
      try {
        for (const k of keys) {
          const record = (await store.get(k))?.[k];
          if (record?.accessToken) await evictGmailToken(record.accessToken);
          await markSignedOut(
            `gmail:${k.slice(googleSessionKey("").length)}`,
            true,
          );
          await store.remove(k);
          cleared = true;
        }
      } catch {
        throw new Error(
          `google sign out failed at=${new Date().toISOString()}`,
        );
      }
    }
    const evicted = await evictGmailToken(token);
    return cleared || evicted;
  });
}

// Chrome supports TokenDetails.account with a stable Google account ID,
// but getAccounts is Dev-channel-only. Stable Chrome cannot enumerate IDs
// for an arbitrary email address. Additional accounts use a registered Web
// application redirect and an implicit token, verified against Gmail profile.
// No token exchange, refresh grant, extra host, or client secret is used.

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GMAIL_PROFILE_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/profile";

// Revalidate a minute early, mirroring the Microsoft side.
const GOOGLE_SKEW_MS = 60_000;
// Chrome-cache tokens carry no known expiry; re-verify every 30 minutes.
const CHROME_TOKEN_TTL_MS = 30 * 60_000;

export function googleSessionKey(account) {
  return `auth.google.${account}`;
}

async function googleClientId() {
  const data =
    await globalThis.chrome?.storage?.local?.get("googleWebClientId");
  if (!data?.googleWebClientId)
    throw new Error("google web client id required");
  return data.googleWebClientId;
}

function googleState() {
  const bytes = new Uint8Array(16);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("google auth unavailable: webcrypto missing");
}

// Account-switch authorize URL: login_hint pins the chooser to the
// requested address so a second Gmail record signs its own mailbox.
export function buildGoogleAuthorizeUrl({
  clientId,
  redirectUri,
  loginHint,
  state,
}) {
  if (!clientId) throw new Error("google auth: clientId required");
  if (!redirectUri) throw new Error("google auth: redirectUri required");
  if (!loginHint) throw new Error("google auth: loginHint required");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "token",
    redirect_uri: redirectUri,
    scope: GMAIL_SCOPE,
    prompt: "consent",
    login_hint: loginHint,
    state: state ?? googleState(),
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export function parseGoogleCallback(callbackUrl, expectedState) {
  let parsed;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    throw new Error("google auth callback invalid");
  }
  const params = new URLSearchParams(parsed.hash.slice(1));
  if (!expectedState || params.get("state") !== expectedState)
    throw new Error("google auth state mismatch");
  if (params.has("error") || !params.get("access_token"))
    throw new Error("google sign in failed");
  return {
    access_token: params.get("access_token"),
    expires_in: Number(params.get("expires_in")) || 3600,
  };
}

function transientError(message) {
  const err = new Error(message);
  err.transient = true;
  return err;
}

// Retryable HTTP statuses: rate-limited, timed out, or server-side
// trouble. 401/403/400 mean the credential or grant itself was refused.
function isTransientStatus(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

// Verified owner of a credential. 401/403 carry the status so callers
// treat a rejected token as an auth failure; transient statuses and
// network failure are transient so a blip never becomes needs-sign-in.
export async function getGmailProfileEmail(token) {
  let res;
  try {
    res = await fetch(GMAIL_PROFILE_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw transientError("google profile request failed");
  }
  if (!res.ok) {
    const err = new Error(`google profile request failed: ${res.status}`);
    err.status = res.status;
    if (isTransientStatus(res.status)) err.transient = true;
    throw err;
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw transientError("google profile parse failed");
  }
  if (!data?.emailAddress) throw new Error("google profile missing address");
  return data.emailAddress;
}

async function readGoogleRecord(account) {
  const store = globalThis.chrome?.storage?.session;
  if (!store?.get) return null;
  const key = googleSessionKey(account);
  const data = await store.get(key);
  return data?.[key] ?? null;
}

async function writeGoogleRecord(account, record, generation) {
  return sessionOp(async () => {
    assertCurrent(`gmail:${account}`, generation);
    const store = globalThis.chrome?.storage?.session;
    if (!store?.set) {
      throw new Error(
        "google auth unavailable: chrome.storage.session missing",
      );
    }
    await store.set({ [googleSessionKey(account)]: record });
    await markSignedOut(`gmail:${account}`, false);
    assertCurrent(`gmail:${account}`, generation);
  });
}

function isRecordFresh(record, now = Date.now()) {
  return (
    !!record?.accessToken && now < (record.expiresAt ?? 0) - GOOGLE_SKEW_MS
  );
}

function accountMismatch(account) {
  const err = new Error(`google account mismatch for ${account}`);
  err.code = "ACCOUNT_MISMATCH";
  return err;
}

function authRequired(account) {
  const err = new Error(`google auth needs sign in for ${account}`);
  err.code = "AUTH_REQUIRED";
  return err;
}

// Account-scoped silent token. Empty account keeps the legacy default
// behavior. Never resolves a credential owned by another mailbox.
export async function getGmailTokenForAccount(account, interactive = false) {
  const generation = capture(`gmail:${account}`);
  await checkSignedOut(`gmail:${account}`, interactive);
  if (!account) return getGmailToken(interactive);
  const now = Date.now();
  const stored = await readGoogleRecord(account);
  assertCurrent(`gmail:${account}`, generation);
  if (isRecordFresh(stored, now)) return stored.accessToken;
  try {
    const token = await getGmailToken(false);
    const email = await getGmailProfileEmail(token);
    if (email.toLowerCase() !== String(account).toLowerCase()) {
      throw accountMismatch(account);
    }
    try {
      await writeGoogleRecord(
        account,
        {
          accessToken: token,
          refreshToken: null,
          expiresAt: now + CHROME_TOKEN_TTL_MS,
          account,
        },
        generation,
      );
    } catch (error) {
      assertCurrent(`gmail:${account}`, generation);
      throw error;
    }
    return token;
  } catch (err) {
    // Recovery while the user is already interacting: a verified mismatch
    // is the account-switch case, and a 401 on profile verification means
    // the cached credential is revoked — both start interactive auth
    // instead of stranding the Sign in button on a dead token.
    if (err?.code === "ACCOUNT_MISMATCH" && interactive) {
      return signInGoogleForAccount(account, generation);
    }
    if (err?.status === 401 && interactive) {
      return signInGoogleForAccount(account, generation);
    }
    if (err?.transient) throw err;
    if (err?.code === "ACCOUNT_MISMATCH" || err?.status !== undefined) {
      throw err;
    }
    if (!interactive) throw authRequired(account);
    return signInGoogleForAccount(account, generation);
  }
}

// Interactive account switch for one Gmail address. Verifies the fresh
// credential before persisting it under that address.
export async function signInGoogleForAccount(
  account,
  generation = capture(`gmail:${account}`),
) {
  if (!account) return getGmailToken(true);
  const id = identity();
  if (!id?.launchWebAuthFlow) {
    throw new Error("google auth unavailable: chrome.identity missing");
  }
  const clientId = await googleClientId();
  const redirectUri = id.getRedirectURL();
  const state = googleState();
  const authUrl = buildGoogleAuthorizeUrl({
    clientId,
    redirectUri,
    loginHint: account,
    state,
  });
  const callbackUrl = await new Promise((resolve, reject) => {
    try {
      id.launchWebAuthFlow({ url: authUrl, interactive: true }, (url) => {
        const err = globalThis.chrome?.runtime?.lastError ?? null;
        if (err || !url) {
          reject(new Error("google sign in cancelled or failed"));
          return;
        }
        resolve(url);
      });
    } catch {
      reject(new Error("google sign in threw"));
    }
  });
  if (!callbackUrl?.startsWith(redirectUri + "#"))
    throw new Error("google auth callback invalid");
  const data = parseGoogleCallback(callbackUrl, state);
  const record = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    account,
  };
  const email = await getGmailProfileEmail(record.accessToken);
  if (email.toLowerCase() !== String(account).toLowerCase()) {
    throw accountMismatch(account);
  }
  await writeGoogleRecord(account, record, generation);
  return record.accessToken;
}

// Chrome manages native token renewal. Web-flow tokens require explicit
// sign-in after expiry if Chrome cannot supply this account's credential.
export async function renewGmailToken(account, rejectedToken) {
  const generation = capture(`gmail:${account}`);
  await checkSignedOut(`gmail:${account}`, false);
  await evictGmailToken(rejectedToken);
  await sessionOp(async () => {
    assertCurrent(`gmail:${account}`, generation);
    await globalThis.chrome?.storage?.session?.remove(
      googleSessionKey(account),
    );
  });
  assertCurrent(`gmail:${account}`, generation);
  const token = await getGmailTokenForAccount(account, false);
  assertCurrent(`gmail:${account}`, generation);
  if (token === rejectedToken) throw authRequired(account);
  return token;
}
