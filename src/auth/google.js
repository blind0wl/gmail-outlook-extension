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
