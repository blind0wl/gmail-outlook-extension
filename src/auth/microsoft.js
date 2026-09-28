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

// Refresh one minute before expiry so a poll never races the clock.
export const TOKEN_SKEW_MS = 60_000;

// Module-level Entra app id. Task 9 integration calls
// configureMicrosoftAuth once with the public application id; getGraphToken
// then keeps its promised one-argument shape. An explicit per-call
// override still wins when supplied.
let configuredClientId = null;

// Monotonic epoch: every sign-out bumps it synchronously, invalidating
// in-flight sign-in/refresh writes captured under an older epoch.
let sessionGeneration = 0;

// Serializes session writes with removals in FIFO order. Combined with the
// generation guard, an earlier operation can never restore a cleared
// session. The tail stays rejection-free so one failure cannot wedge the
// queue; each caller observes errors through its own handle.
let sessionTail = Promise.resolve();

function identity() {
  return globalThis.chrome?.identity;
}

function sessionStore() {
  return globalThis.chrome?.storage?.session;
}

export function scopeString() {
  return MS_SCOPES.join(" ");
}

export function configureMicrosoftAuth({ clientId } = {}) {
  if (!clientId) throw new Error("microsoft auth: clientId required");
  configuredClientId = clientId;
}

export function getConfiguredClientId() {
  return configuredClientId;
}

function resolveClientId(override) {
  const id = override ?? configuredClientId;
  if (!id) throw new Error("microsoft auth: clientId not configured");
  return id;
}

function enqueueSessionOp(op) {
  const run = sessionTail.then(op, op);
  sessionTail = run.catch(() => {});
  return run;
}

// Persists a token record only if no sign-out has intervened since the flow
// started; otherwise rejects so the caller never uses a token the cleared
// session no longer holds. Runs inside the session queue, ordered against
// removals.
function guardedSessionWrite(record, generation) {
  return enqueueSessionOp(async () => {
    if (generation !== sessionGeneration) {
      throw new Error("microsoft auth superseded by sign out");
    }
    await writeSessionRecord(record);
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
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
    throw new Error(`microsoft auth denied: ${err}`);
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
  const res = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    throw new Error(`microsoft token exchange failed: ${res.status}`);
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("microsoft token exchange parse failed");
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

export async function readSessionRecord() {
  const store = sessionStore();
  if (!store?.get) return null;
  const data = await store.get(MS_SESSION_KEY);
  return data?.[MS_SESSION_KEY] ?? null;
}

export async function writeSessionRecord(record) {
  const store = sessionStore();
  if (!store?.set) {
    throw new Error("microsoft auth unavailable: chrome.storage.session missing");
  }
  await store.set({ [MS_SESSION_KEY]: record });
}

export function isFresh(record, now = Date.now()) {
  return (
    !!record?.accessToken && now < (record.expiresAt ?? 0) - TOKEN_SKEW_MS
  );
}

// Full interactive sign in: PKCE -> authorize -> code -> token -> session.
// The client id is the public Entra app id (Personal accounts only); it is
// a public identifier, never a secret. It defaults to the id set via
// configureMicrosoftAuth, with an explicit argument winning when given.
export async function signInMicrosoft(clientId, generation = sessionGeneration) {
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
  return guardedSessionWrite(record, generation);
}

async function tryRefresh(clientId, refreshToken, generation = sessionGeneration) {
  const data = await postToken({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const record = toRecord(data);
  // Preserve the old refresh token if the response rotates none in.
  if (!record.refreshToken) record.refreshToken = refreshToken;
  return guardedSessionWrite(record, generation);
}

// Primary entry matching the worker's token shape: getGraphToken(interactive).
// The Entra app id comes from configureMicrosoftAuth (Task 9 integration);
// an explicit per-call override still wins.
// Silent when interactive=false: cached-or-refresh only, never a popup.
// Interactive when true: falls back to the full sign-in flow.
export async function getGraphToken(interactive = true, { clientId } = {}) {
  const resolvedId = resolveClientId(clientId);
  // Epoch for the whole operation, fixed before any await.
  const generation = sessionGeneration;
  const cached = await readSessionRecord();
  if (isFresh(cached)) return cached.accessToken;
  if (cached?.refreshToken) {
    try {
      return await tryRefresh(resolvedId, cached.refreshToken, generation);
    } catch {
      // Fall through to interactive sign in below.
    }
  }
  if (!interactive) {
    throw new Error("microsoft auth needs sign in");
  }
  return signInMicrosoft(resolvedId, generation);
}

// Sign out: bumps the epoch first (synchronously, so in-flight flows are
// invalidated before they can write), then queues removal behind earlier
// ops. Resolves true when cleared and rejects with a sanitized error when
// removal fails or no session store exists, so callers can report
// incomplete sign-out.
export async function clearGraphToken() {
  sessionGeneration += 1;
  return enqueueSessionOp(async () => {
    const store = sessionStore();
    if (!store?.remove) {
      throw new Error(
        "microsoft auth unavailable: chrome.storage.session missing",
      );
    }
    try {
      await store.remove(MS_SESSION_KEY);
    } catch {
      throw new Error("microsoft sign out failed");
    }
    return true;
  });
}
