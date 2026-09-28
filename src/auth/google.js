// Google auth for Gmail read-only access.
//
// Uses chrome.identity.getAuthToken (Chrome manages the OAuth dance against
// the client id pinned in manifest.json oauth2 section). Clearing uses
// chrome.identity.removeCachedAuthToken. No tokens are logged or persisted
// here; Chrome holds the cached token and charge of refresh.

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

// Sign out helper. Removes one token from Chrome's cache; callers clear
// each token they hold. Resolves true when removed, false when there was
// nothing to remove (no token or no chrome.identity), and rejects with a
// sanitized error when removal itself fails so callers can report
// incomplete sign-out.
export function clearGmailToken(token) {
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

// ---- Per-account Gmail tokens (multi-mailbox support) ----
//
// chrome.identity.getAuthToken takes no account parameter: it always
// resolves the default-account credential. Handing that token to a second
// Gmail record would poll the wrong mailbox, so the worker must never use
// the bare default token for a named account. It calls
// getGmailTokenForAccount instead:
//
// - Silent: prefer the account-bound session record (with its refresh
//   token), else take the Chrome-cached token and verify it belongs to the
//   requested account via the Gmail profile endpoint. A mismatch rejects
//   with ACCOUNT_MISMATCH; the wrong mailbox's credential is never returned.
// - Interactive (account switch): chrome.identity.launchWebAuthFlow against
//   Google OAuth with login_hint=<account> plus PKCE (code flow, offline
//   access so a refresh token is issued), then verify the profile email
//   before persisting the account-bound record. This is the chosen switch
//   mechanism because getAuthToken cannot target a non-default account.
//
// Records live in chrome.storage.session under googleSessionKey(account).
// All errors are sanitized (no tokens, no response bodies). Network-level
// failures carry transient=true so callers can tell a blip from a dead
// grant; authentication failures carry code AUTH_REQUIRED or
// ACCOUNT_MISMATCH.

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GMAIL_PROFILE_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/profile";

// Revalidate a minute early, mirroring the Microsoft side.
const GOOGLE_SKEW_MS = 60_000;
// Chrome-cache tokens carry no known expiry; re-verify every 30 minutes.
const CHROME_TOKEN_TTL_MS = 30 * 60_000;

export function googleSessionKey(account) {
  return `auth.google.${account}`;
}

function googleClientId() {
  const id = globalThis.chrome?.runtime?.getManifest?.()?.oauth2?.client_id;
  if (!id) throw new Error("google auth unavailable: oauth client id missing");
  return id;
}

function base64UrlBytes(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// PKCE pair per RFC 7636, local so this module stays self-contained.
export async function generateGooglePkce() {
  const random = new Uint8Array(32);
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues || !cryptoObj?.subtle) {
    throw new Error("google auth unavailable: webcrypto missing");
  }
  cryptoObj.getRandomValues(random);
  const verifier = base64UrlBytes(random);
  const digest = await cryptoObj.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64UrlBytes(new Uint8Array(digest)) };
}

function googleState() {
  const bytes = new Uint8Array(16);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
    return base64UrlBytes(bytes);
  }
  return `gs-${Date.now()}`;
}

// Account-switch authorize URL: login_hint pins the chooser to the
// requested address so a second Gmail record signs its own mailbox.
export function buildGoogleAuthorizeUrl({
  clientId,
  redirectUri,
  loginHint,
  codeChallenge,
  state,
}) {
  if (!clientId) throw new Error("google auth: clientId required");
  if (!redirectUri) throw new Error("google auth: redirectUri required");
  if (!loginHint) throw new Error("google auth: loginHint required");
  if (!codeChallenge) throw new Error("google auth: codeChallenge required");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    login_hint: loginHint,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
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
  const err = parsed.searchParams.get("error");
  if (err) throw new Error(`google auth denied: ${err}`);
  const state = parsed.searchParams.get("state");
  if (expectedState && state !== expectedState) {
    throw new Error("google auth state mismatch");
  }
  const code = parsed.searchParams.get("code");
  if (!code) throw new Error("google auth callback missing code");
  return code;
}

function transientError(message) {
  const err = new Error(message);
  err.transient = true;
  return err;
}

async function exchangeGoogleCode({ clientId, redirectUri, code, verifier }) {
  let res;
  try {
    res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });
  } catch {
    throw transientError("google token request failed");
  }
  if (!res.ok) {
    const err = new Error(`google token exchange failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw transientError("google token exchange parse failed");
  }
  if (!data.access_token) throw new Error("google token exchange missing token");
  return data;
}

// Verified owner of a credential. 401s carry the status so callers treat a
// rejected token as an auth failure; network failure is transient.
export async function getGmailProfileEmail(token) {
  let res;
  try {
    res = await fetch(GMAIL_PROFILE_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw transientError("google profile request failed");
  }
  if (!res.ok) {
    const err = new Error(`google profile request failed: ${res.status}`);
    err.status = res.status;
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

async function writeGoogleRecord(account, record) {
  const store = globalThis.chrome?.storage?.session;
  if (!store?.set) {
    throw new Error("google auth unavailable: chrome.storage.session missing");
  }
  await store.set({ [googleSessionKey(account)]: record });
}

function isRecordFresh(record, now = Date.now()) {
  return !!record?.accessToken && now < (record.expiresAt ?? 0) - GOOGLE_SKEW_MS;
}

async function refreshGoogleRecord(account, record) {
  const clientId = googleClientId();
  let res;
  try {
    res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: record.refreshToken,
      }),
    });
  } catch {
    throw transientError("google token refresh failed");
  }
  if (!res.ok) {
    const err = new Error(`google token refresh failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw transientError("google token refresh parse failed");
  }
  if (!data.access_token) throw new Error("google token refresh missing token");
  const next = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? record.refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    account,
  };
  await writeGoogleRecord(account, next);
  return next.accessToken;
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
  if (!account) return getGmailToken(interactive);
  const now = Date.now();
  const stored = await readGoogleRecord(account);
  if (isRecordFresh(stored, now)) return stored.accessToken;
  if (stored?.refreshToken) {
    try {
      return await refreshGoogleRecord(account, stored);
    } catch {
      // Fall through to the Chrome cache, then interactive.
    }
  }
  try {
    const token = await getGmailToken(false);
    const email = await getGmailProfileEmail(token);
    if (email.toLowerCase() !== String(account).toLowerCase()) {
      throw accountMismatch(account);
    }
    try {
      await writeGoogleRecord(account, {
        accessToken: token,
        refreshToken: stored?.refreshToken ?? null,
        expiresAt: now + CHROME_TOKEN_TTL_MS,
        account,
      });
    } catch {
      // Stateless fallback: the verified token is still returned.
    }
    return token;
  } catch (err) {
    // A verified mismatch under an interactive call is the account-switch
    // case: fall through to the login_hint web flow below.
    if (err?.code === "ACCOUNT_MISMATCH" && interactive) {
      return signInGoogleForAccount(account);
    }
    if (err?.code === "ACCOUNT_MISMATCH" || err?.status !== undefined || err?.transient) {
      throw err;
    }
    if (!interactive) throw authRequired(account);
    return signInGoogleForAccount(account);
  }
}

// Interactive account switch for one Gmail address. Verifies the fresh
// credential before persisting it under that address.
export async function signInGoogleForAccount(account) {
  if (!account) return getGmailToken(true);
  const id = identity();
  if (!id?.launchWebAuthFlow) {
    throw new Error("google auth unavailable: chrome.identity missing");
  }
  const clientId = googleClientId();
  const redirectUri = id.getRedirectURL();
  const { verifier, challenge } = await generateGooglePkce();
  const state = googleState();
  const authUrl = buildGoogleAuthorizeUrl({
    clientId,
    redirectUri,
    loginHint: account,
    codeChallenge: challenge,
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
  const code = parseGoogleCallback(callbackUrl, state);
  const data = await exchangeGoogleCode({ clientId, redirectUri, code, verifier });
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
  await writeGoogleRecord(account, record);
  return record.accessToken;
}

// Forced silent renewal after a 401: evict the rejected credential from
// the Chrome cache and the account slot, then acquire silently. Never
// returns the rejected token; throws AUTH_REQUIRED when renewal fails so
// the caller drives explicit interactive recovery.
export async function renewGmailToken(account, rejectedToken) {
  try {
    await clearGmailToken(rejectedToken);
  } catch {
    // Eviction is best-effort; renewal still proceeds.
  }
  if (account) {
    try {
      const store = globalThis.chrome?.storage?.session;
      const key = googleSessionKey(account);
      const data = await store?.get?.(key);
      const rec = data?.[key];
      if (rec && rec.accessToken === rejectedToken) {
        await store.set({ [key]: { ...rec, accessToken: null, expiresAt: 0 } });
      }
    } catch {
      // Eviction is best-effort; renewal still proceeds.
    }
  }
  const token = await getGmailTokenForAccount(account, false);
  if (rejectedToken && token === rejectedToken) throw authRequired(account);
  return token;
}
