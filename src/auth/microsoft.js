import {
  capture,
  assertCurrent,
  invalidate,
  sessionOp,
  checkSignedOut,
  markSignedOut,
} from "./session-guard.js";
// Microsoft auth for Outlook.com personal accounts.
//
// Public client using chrome.identity.launchWebAuthFlow with PKCE against
// the consumers authority. No secret is bundled or sent; the token endpoint
// receives client_id plus PKCE verifier only. Tokens persist in
// chrome.storage.session under MS_SESSION_KEY and clear on sign out.
//
// Runtime scopes (never in manifest.json):
//   User.Read, Mail.Read, offline_access
// Never request Mail.Read.Shared (work accounts) or send/write scopes.

export const MS_AUTHORITY = "https://login.microsoftonline.com/consumers";
export const MS_SCOPES = ["User.Read", "Mail.Read", "offline_access"];
export const MS_SESSION_KEY = "auth.microsoft.graph";
export const GRAPH_ME_URL =
  "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName";

// Refresh one minute before expiry so a poll never races the clock.
export const TOKEN_SKEW_MS = 60_000;

// Module-level Entra app id. Task 9 integration calls
// configureMicrosoftAuth once with the public application id; getGraphToken
// then keeps its promised one-argument shape. An explicit per-call
// override still wins when supplied.
let configuredClientId = null;

// Monotonic epoch: every sign-out bumps it synchronously, invalidating
// in-flight sign-in/refresh writes captured under an older epoch.
function guardKey(sessionKey = MS_SESSION_KEY) {
  return `outlook:${sessionKey === MS_SESSION_KEY ? "" : sessionKey.slice(MS_SESSION_KEY.length + 1)}`;
}

// Serializes session writes with removals in FIFO order. Combined with the
// generation guard, an earlier operation can never restore a cleared
// session. The tail stays rejection-free so one failure cannot wedge the
// queue; each caller observes errors through its own handle.

function identity() {
  return globalThis.chrome?.identity;
}

function sessionStore() {
  return globalThis.chrome?.storage?.session;
}

export function scopeString() {
  return MS_SCOPES.join(" ");
}

// Per-account session slots. The legacy single slot (MS_SESSION_KEY) stays
// the default so existing callers are unaffected; the worker addresses one
// slot per Outlook record so two mailboxes never share a credential.
export function sessionKeyFor(account) {
  return account ? `${MS_SESSION_KEY}:${account}` : MS_SESSION_KEY;
}

// Developer-owned Entra application id shipped with the extension. A
// client id is a public identifier, never a secret. Replace the
// placeholder with the real id once the app registration exists;
// per-account clientId values still override it.
export const ENTRA_APP_ID = "9e67dec6-14f7-4e74-999e-ac7c1f1da358";

export function defaultAppId() {
  return /^YOUR_/i.test(ENTRA_APP_ID) ? undefined : ENTRA_APP_ID;
}

export function configureMicrosoftAuth({ clientId } = {}) {
  if (!clientId) throw new Error("microsoft auth: clientId required");
  configuredClientId = clientId;
}

export function getConfiguredClientId() {
  return configuredClientId;
}

function resolveClientId(override) {
  // First non-blank wins: stored "" values must fall through to the
  // baked-in default instead of shadowing it ("" is not nullish).
  const id = [override, configuredClientId, defaultAppId()].find(
    (v) => typeof v === "string" && v.trim() !== "",
  );
  if (!id || /^YOUR_/i.test(id)) throw new Error("microsoft auth: clientId not configured");
  return id;
}

function enqueueSessionOp(op) {
  return sessionOp(op);
}

// Marks network-level failures so callers can tell a blip from a dead
// grant. HTTP failures with a transient status (rate limit, server
// trouble, timeout) are marked transient too: the grant may be fine and
// the session must be kept. Other authentication failures keep no marker
// and mean re-auth.
function asTransient(err) {
  err.transient = true;
  return err;
}

// Retryable HTTP statuses: rate-limited, timed out, or server-side trouble.
// 401/403/400 mean the credential or grant itself was refused.
function isTransientStatus(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function accountMismatchError(account) {
  const err = new Error(`microsoft account mismatch for ${account}`);
  err.code = "ACCOUNT_MISMATCH";
  return err;
}

// Verified owner of a credential, mirroring the Gmail profile check:
// login_hint pins the chooser but the user can still pick another account,
// so the address is confirmed before anything is stored under it.
// Every address Graph attributes to this token's mailbox: primary mail
// plus userPrincipalName. Personal accounts routinely differ here (an
// outlook.com alias over a hotmail.com account and vice versa), so
// ownership accepts any of them — a wholly unrelated address still
// rejects.
export async function getGraphAccountIdentities(token) {
  let res;
  try {
    res = await fetch(GRAPH_ME_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw asTransient(new Error("microsoft profile request failed"));
  }
  if (!res.ok) {
    const err = new Error(`microsoft profile request failed: ${res.status}`);
    err.status = res.status;
    if (isTransientStatus(res.status)) err.transient = true;
    throw err;
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw asTransient(new Error("microsoft profile parse failed"));
  }
  const out = [];
  for (const candidate of [data?.mail, data?.userPrincipalName]) {
    if (typeof candidate !== "string" || !candidate) continue;
    if (!out.some((a) => a.toLowerCase() === candidate.toLowerCase())) {
      out.push(candidate);
    }
  }
  if (!out.length) throw new Error("microsoft profile missing address");
  return out;
}

export async function getGraphAccountAddress(token) {
  return (await getGraphAccountIdentities(token))[0];
}

function ownsAddress(identities, account) {
  const want = String(account ?? "").toLowerCase();
  return (identities ?? []).some(
    (a) => String(a ?? "").toLowerCase() === want,
  );
}

// Persists a token record only if no sign-out has intervened since the flow
// started; otherwise rejects so the caller never uses a token the cleared
// session no longer holds. Runs inside the session queue, ordered against
// removals.
function guardedSessionWrite(record, generation, sessionKey = MS_SESSION_KEY) {
  return enqueueSessionOp(async () => {
    assertCurrent(guardKey(sessionKey), generation);
    await writeSessionRecord(record, sessionKey);
    await markSignedOut(guardKey(sessionKey), false);
    assertCurrent(guardKey(sessionKey), generation);
    return record.accessToken;
  });
}

// Redirect comes from Chrome; shape is always
// https://<extension-id>.chromiumapp.org[/<path>].
export function getRedirectUri() {
  const id = identity();
  if (!id?.getRedirectURL) {
    throw new Error("microsoft auth unavailable: chrome.identity missing");
  }
  return id.getRedirectURL();
}

function base64Url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// PKCE pair per RFC 7636: 43-128 char verifier, S256 challenge.
export async function generatePkce() {
  const random = new Uint8Array(32);
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues || !cryptoObj?.subtle) {
    throw new Error("microsoft auth unavailable: webcrypto missing");
  }
  cryptoObj.getRandomValues(random);
  const verifier = base64Url(random);
  const digest = await cryptoObj.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = base64Url(new Uint8Array(digest));
  return { verifier, challenge };
}

export function randomState() {
  const bytes = new Uint8Array(16);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
    return base64Url(bytes);
  }
  return `st-${Date.now()}`;
}

// Pure URL builder: easy to assert authority, scopes, PKCE posture, and
// the absence of any bundled secret without performing network I/O.
export function buildAuthorizeUrl({
  clientId,
  redirectUri,
  codeChallenge,
  state,
  loginHint,
}) {
  if (!clientId) throw new Error("microsoft auth: clientId required");
  if (!redirectUri) throw new Error("microsoft auth: redirectUri required");
  if (!codeChallenge) throw new Error("microsoft auth: codeChallenge required");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopeString(),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: state ?? randomState(),
  });
  // login_hint pins the chooser to the requested address for multi-account.
  if (loginHint) params.set("login_hint", loginHint);
  return `${MS_AUTHORITY}/oauth2/v2.0/authorize?${params}`;
}

// Extracts the authorization code from the launchWebAuthFlow redirect.
// Throws sanitized errors only (no tokens, no response bodies).
export function parseAuthCallback(callbackUrl, expectedState) {
  let parsed;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    throw new Error("microsoft auth callback invalid");
  }
  const err = parsed.searchParams.get("error");
  if (err) {
    throw new Error("microsoft auth denied");
  }
  const state = parsed.searchParams.get("state");
  if (expectedState && state !== expectedState) {
    throw new Error("microsoft auth state mismatch");
  }
  const code = parsed.searchParams.get("code");
  if (!code) {
    throw new Error("microsoft auth callback missing code");
  }
  return code;
}

async function postToken(body) {
  let res;
  try {
    res = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
  } catch {
    throw asTransient(new Error("microsoft token request failed"));
  }
  if (!res.ok) {
    const err = new Error(`microsoft token exchange failed: ${res.status}`);
    err.status = res.status;
    if (isTransientStatus(res.status)) err.transient = true;
    throw err;
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw asTransient(new Error("microsoft token exchange parse failed"));
  }
  if (!data.access_token) {
    throw new Error("microsoft token exchange missing token");
  }
  return data;
}

function toRecord(data, now = Date.now()) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
}

export async function readSessionRecord(sessionKey = MS_SESSION_KEY) {
  const store = sessionStore();
  if (!store?.get) return null;
  const data = await store.get(sessionKey);
  return data?.[sessionKey] ?? null;
}

export async function writeSessionRecord(record, sessionKey = MS_SESSION_KEY) {
  const store = sessionStore();
  if (!store?.set) {
    throw new Error(
      "microsoft auth unavailable: chrome.storage.session missing",
    );
  }
  await store.set({ [sessionKey]: record });
}

// Best-effort eviction of one session slot. Never throws.
async function evictSessionRecord(sessionKey) {
  try {
    await sessionStore()?.remove?.(sessionKey);
  } catch {
    // Eviction is best-effort; renewal still proceeds.
  }
}

export function isFresh(record, now = Date.now()) {
  return !!record?.accessToken && now < (record.expiresAt ?? 0) - TOKEN_SKEW_MS;
}

// Full interactive sign in: PKCE -> authorize -> code -> token -> session.
// The client id is the public Entra app id (Personal accounts only); it is
// a public identifier, never a secret. It defaults to the id set via
// configureMicrosoftAuth, with an explicit argument winning when given.
// opts selects the session slot and pins the chooser: { loginHint,
// sessionKey, account }. Defaults preserve the legacy single-slot flow.
export async function signInMicrosoft(
  clientId,
  generation = undefined,
  opts = {},
) {
  const { loginHint, sessionKey = MS_SESSION_KEY, account } = opts;
  generation ??= capture(guardKey(sessionKey));
  const resolvedId = resolveClientId(clientId);
  // Epoch is fixed at entry (synchronously, via the default above for
  // direct callers). getGraphToken captures it before any await and passes
  // it through so the whole operation shares one epoch: a sign-out
  // landing anywhere below invalidates the session write at the end.
  const id = identity();
  if (!id?.launchWebAuthFlow) {
    throw new Error("microsoft auth unavailable: chrome.identity missing");
  }
  const redirectUri = getRedirectUri();
  const { verifier, challenge } = await generatePkce();
  const state = randomState();
  const authUrl = buildAuthorizeUrl({
    clientId: resolvedId,
    redirectUri,
    codeChallenge: challenge,
    state,
    loginHint,
  });
  const callbackUrl = await new Promise((resolve, reject) => {
    try {
      id.launchWebAuthFlow({ url: authUrl, interactive: true }, (url) => {
        const err = globalThis.chrome?.runtime?.lastError ?? null;
        if (err || !url) {
          reject(new Error("microsoft sign in cancelled or failed"));
          return;
        }
        resolve(url);
      });
    } catch {
      reject(new Error("microsoft sign in threw"));
    }
  });
  const code = parseAuthCallback(callbackUrl, state);
  const data = await postToken({
    client_id: resolvedId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const record = toRecord(data);
  if (account !== undefined) record.account = account;
  if (account) {
    // Ownership check before storing: login_hint is a hint, not a proof —
    // the user may have completed the flow as another address. Any of
    // the mailbox's Graph identities satisfies it (aliases share one
    // mailbox); anything else rejects.
    const identities = await getGraphAccountIdentities(record.accessToken);
    if (!ownsAddress(identities, account)) {
      throw accountMismatchError(account);
    }
  }
  return guardedSessionWrite(record, generation, sessionKey);
}

async function tryRefresh(
  clientId,
  refreshToken,
  generation = undefined,
  opts = {},
) {
  const { sessionKey = MS_SESSION_KEY, account } = opts;
  generation ??= capture(guardKey(sessionKey));
  const data = await postToken({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const record = toRecord(data);
  // Preserve the old refresh token if the response rotates none in.
  if (!record.refreshToken) record.refreshToken = refreshToken;
  // Preserve the account binding across rotation.
  if (account !== undefined) {
    record.account = account;
  } else {
    try {
      const current = await readSessionRecord(sessionKey);
      if (current?.account) record.account = current.account;
    } catch {
      // Binding preservation is best-effort.
    }
  }
  if (record.account) {
    // Re-verify on rotation too: the stored credential must still belong
    // to the bound address before it replaces the slot contents.
    const identities = await getGraphAccountIdentities(record.accessToken);
    if (!ownsAddress(identities, record.account)) {
      throw accountMismatchError(record.account);
    }
  }
  return guardedSessionWrite(record, generation, sessionKey);
}

// Account-scoped token matching the worker's per-record shape. Empty
// account keeps the legacy single-slot behavior. Never resolves a
// credential stored under another address: each account owns its slot.
export async function getGraphTokenForAccount(
  account,
  interactive = true,
  { clientId } = {},
) {
  const resolvedId = resolveClientId(clientId);
  const key = sessionKeyFor(account);
  // Epoch for the whole operation, fixed before any await.
  const generation = capture(guardKey(key));
  await checkSignedOut(guardKey(key), interactive);
  const cached = await readSessionRecord(key);
  assertCurrent(guardKey(key), generation);
  if (isFresh(cached)) return cached.accessToken;
  let refreshErr = null;
  if (cached?.refreshToken) {
    try {
      return await tryRefresh(resolvedId, cached.refreshToken, generation, {
        sessionKey: key,
        account: account || cached.account,
      });
    } catch (e) {
      refreshErr = e;
    }
  }
  if (!interactive) {
    // A transient refresh failure stays transient: the grant may be fine
    // and must not surface as needs-sign-in.
    if (refreshErr?.transient) throw refreshErr;
    throw new Error("microsoft auth needs sign in");
  }
  return signInMicrosoft(resolvedId, generation, {
    loginHint: account || undefined,
    sessionKey: key,
    account: account || undefined,
  });
}

function authRequiredError() {
  const err = new Error("microsoft auth needs sign in");
  err.code = "AUTH_REQUIRED";
  return err;
}

// Classify a forced-renewal failure: transient blips (marked by the
// provider, including transient HTTP statuses and network failure) keep
// the session and propagate as-is. Only dead grants become AUTH_REQUIRED.
function classifyRenewalError(err) {
  if (err?.transient) return err;
  const message = String(err?.message ?? "");
  if (
    typeof err?.status === "number" ||
    /failed: \d+/.test(message) ||
    /missing token|needs sign in|superseded by sign out|not configured|unavailable|mismatch/.test(
      message,
    )
  ) {
    return authRequiredError();
  }
  return asTransient(
    err instanceof Error ? err : new Error("microsoft token renewal failed"),
  );
}

// Forced silent renewal after a 401: the locally unexpired cached token is
// rejected by the server, so bypass the freshness check and spend the
// refresh token. Evicts the slot when the grant is dead (never on a
// transient blip). Never returns the rejected token; throws AUTH_REQUIRED
// when renewal fails so the caller drives explicit interactive recovery.
export async function renewGraphToken(
  account,
  rejectedToken,
  { clientId } = {},
) {
  const resolvedId = resolveClientId(clientId);
  const key = sessionKeyFor(account);
  const generation = capture(guardKey(key));
  await checkSignedOut(guardKey(key), false);
  const store = sessionStore();
  const data = await store?.get?.(key);
  assertCurrent(guardKey(key), generation);
  const rec = data?.[key] ?? null;
  if (rec?.accessToken && rec.accessToken !== rejectedToken && isFresh(rec)) {
    return rec.accessToken;
  }
  if (rec?.refreshToken) {
    try {
      const fresh = await tryRefresh(resolvedId, rec.refreshToken, generation, {
        sessionKey: key,
        account: account || rec.account,
      });
      if (rejectedToken && fresh === rejectedToken) throw authRequiredError();
      return fresh;
    } catch (err) {
      const classified = classifyRenewalError(err);
      if (!classified.transient)
        await enqueueSessionOp(async () => {
          assertCurrent(guardKey(key), generation);
          await evictSessionRecord(key);
        });
      throw classified;
    }
  }
  // No refresh path: evict the rejected slot so it is never reused.
  await enqueueSessionOp(async () => {
    assertCurrent(guardKey(key), generation);
    await evictSessionRecord(key);
  });
  throw authRequiredError();
}

// Primary entry matching the worker's token shape: getGraphToken(interactive).
// The Entra app id comes from configureMicrosoftAuth (Task 9 integration);
// an explicit per-call override still wins.
// Silent when interactive=false: cached-or-refresh only, never a popup.
// Interactive when true: falls back to the full sign-in flow.
export async function getGraphToken(interactive = true, { clientId } = {}) {
  const key = MS_SESSION_KEY;
  const resolvedId = resolveClientId(clientId);
  // Epoch for the whole operation, fixed before any await.
  const generation = capture(guardKey(key));
  await checkSignedOut(guardKey(), interactive);
  const cached = await readSessionRecord();
  assertCurrent(guardKey(), generation);
  if (isFresh(cached)) return cached.accessToken;
  let refreshErr = null;
  if (cached?.refreshToken) {
    try {
      return await tryRefresh(resolvedId, cached.refreshToken, generation);
    } catch (e) {
      refreshErr = e;
    }
  }
  if (!interactive) {
    if (refreshErr?.transient) throw refreshErr;
    throw new Error("microsoft auth needs sign in");
  }
  return signInMicrosoft(resolvedId, generation);
}

// Sign out every Microsoft slot this extension writes: the legacy slot
// plus all per-account slots. Resolves true when cleared and rejects with
// a sanitized error when removal fails or no session store exists, so
// callers can report incomplete sign-out. Previously cleared credentials
// stay unusable: the epoch bump invalidates in-flight writes and every
// slot they could land in is removed.
export async function clearGraphToken(account) {
  invalidate(account === undefined ? "outlook" : `outlook:${account}`);
  return enqueueSessionOp(async () => {
    const store = sessionStore();
    if (account !== undefined) {
      await markSignedOut(`outlook:${account}`, true);
      if (!store?.remove) throw new Error("microsoft sign out failed");
      await store.remove(sessionKeyFor(account));
      return true;
    }
    if (!store?.remove) {
      throw new Error(
        "microsoft auth unavailable: chrome.storage.session missing",
      );
    }
    // Without get there is no way to enumerate slots that may remain
    // usable: report incomplete sign-out instead of blind success.
    if (typeof store.get !== "function") {
      throw new Error("microsoft sign out failed");
    }
    let keys = [MS_SESSION_KEY];
    try {
      // get(null) returns every key in the area; fall back to the legacy
      // slot when it yields nothing usable.
      const all = await store.get(null);
      if (all && typeof all === "object") {
        const found = Object.keys(all).filter(
          (k) => k === MS_SESSION_KEY || k.startsWith(`${MS_SESSION_KEY}:`),
        );
        if (found.length) keys = found;
      }
    } catch {
      // Enumeration failed: slots may remain usable. Remove the legacy
      // slot best-effort, then report incomplete sign-out.
      try {
        await store.remove(MS_SESSION_KEY);
      } catch {
        // Removal failure is already reported below via the throw.
      }
      throw new Error("microsoft sign out failed");
    }
    try {
      for (const k of keys) {
        await markSignedOut(guardKey(k), true);
        await store.remove(k);
      }
    } catch {
      throw new Error("microsoft sign out failed");
    }
    return true;
  });
}
