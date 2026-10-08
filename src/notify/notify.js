// Notification helpers plus the storage persistence bridge.
// Pure logic (counts, toast shaping) lives here so it is testable
// under Node. The chrome.* calls are isolated in persistCache/hydrateCache
// and degrade to no-ops where chrome does not exist (Node tests, which
// stub globalThis.chrome with an in-memory double instead).

import { mergeMessages, getInbox } from "../store/cache.js";

// storage.local keys. Task 7 popup reads CACHE_KEY in this same shape.
export const CACHE_KEY = "mailCache";
export const ACCOUNT_STATE_KEY = "accountState";

// Server-unread items the user has not read locally.
export function unreadCount(items) {
  return items.filter((i) => i.unread && !i.localRead).length;
}

// One grouped toast per account: single subject, or count plus latest.
export function buildToast(group) {
  const n = group.items.length;
  const latest = group.items[0]?.subject || "(no subject)";
  return {
    title: `${group.account} (${group.provider})`,
    message: n === 1 ? latest : `${n} new messages — latest: ${latest}`,
  };
}

// Stable silent-auth failure reasons (#20). Fixed set only; anything else
// is dropped rather than persisted or displayed.
const ERROR_REASONS = new Set(["signed-out", "missing-record", "refresh-failed"]);
const ERROR_CODES = /^(?:AUTH_REQUIRED|(?:invalid_request|invalid_client|invalid_grant|unauthorized_client|unsupported_grant_type|invalid_scope|access_denied|server_error|temporarily_unavailable|interaction_required|login_required|consent_required)(?:\/AADSTS\d{1,10})?|AADSTS\d{1,10})$/;

function diagnosticCode(code) {
  return typeof code === "string" && ERROR_CODES.test(code) ? code : undefined;
}

// Boundary sanitizer for poll errors. Provider adapters already throw
// sanitized errors, but token callbacks and test fakes can throw anything
// (including mail content). Keep only permitted identifiers: HTTP status,
// allowlisted endpoint code and reason, account address, and a timestamp.
// Free-text messages are dropped.
export function sanitizeError(err, acct) {
  const status = typeof err?.status === "number" ? err.status : undefined;
  const clean = new Error(
    status !== undefined ? `poll failed: ${status}` : "poll failed",
  );
  clean.name = "PollError";
  if (status !== undefined) clean.status = status;
  const code = diagnosticCode(err?.code);
  if (code) clean.code = code;
  if (typeof err?.reason === "string" && ERROR_REASONS.has(err.reason)) {
    clean.reason = err.reason;
  }
  if (acct?.account) clean.account = acct.account;
  clean.at = new Date().toISOString();
  return clean;
}

function storageLocal() {
  return globalThis.chrome?.storage?.local;
}

// Short retry text for stale labels. Under a minute reads "in Ns",
// older reads the local clock ("14:03"). Pure, for popup and tests.
export function formatRetryAt(retryAt, now = Date.now()) {
  const ms = retryAt - now;
  if (ms <= 0) return "now";
  if (ms <= 60_000) return `in ${Math.round(ms / 1000)}s`;
  return new Date(retryAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// One plain line per account error state, address plus code only — never
// subject, snippet, or body. Extra fields on state are ignored by design.
// Returns null when the account is healthy (no error UI).
export function accountStatusLabel(acct, state = {}) {
  const address = acct?.account ?? acct?.address ?? "";
  if (state.needsSignIn) {
    if (acct?.provider === "gmail") {
      return `${address} — log into Gmail in the opened tab, then press Refresh`;
    }
    // Outlook cause hint (#20): sanitized code/reason only, never raw text.
    // Missing suffix means the cause predates cause tracking — re-poll once.
    const code = diagnosticCode(state.code);
    const cause = code
      ? ` (${code})`
      : state.reason === "missing-record"
        ? " (session ended)"
        : state.reason === "refresh-failed"
          ? " (renewal failed)"
          : "";
    return `${address} — needs sign in${cause}`;
  }
  if (state.offline) return `${address} — offline, showing saved mail`;
  if (state.backedOff) {
    const when = state.retryAt ? `retry ${formatRetryAt(state.retryAt)}` : "retry pending";
    const code = state.status !== undefined ? ` (${state.status})` : "";
    return `${address} — stale, ${when}${code}; retries automatically`;
  }
  // Sanitized stale indicator for status-less online failures: no retry
  // time, no code, and never raw error text.
  if (state.stale) return `${address} — stale, showing saved mail`;
  if (state.status !== undefined || state.error) {
    const code = state.status !== undefined ? ` (${state.status})` : "";
    return `${address} — last poll failed${code}; try Refresh`;
  }
  return null;
}

// Persist the merged inbox after every successful poll. No-op without chrome.
export async function persistCache(items) {
  const store = storageLocal();
  if (!store) return;
  await store.set({ [CACHE_KEY]: items ?? getInbox() });
}

// Hydrate process memory from storage before the first poll. No-op ([]) without chrome.
export async function hydrateCache() {
  const store = storageLocal();
  if (!store) return [];
  const data = await store.get(CACHE_KEY);
  const items = data?.[CACHE_KEY] ?? [];
  if (items.length) mergeMessages(items.map(item => {
    const prefix = `${item.provider}:${encodeURIComponent(item.account)}:`;
    const key = item.key.startsWith(prefix) ? item.key : prefix + item.key.slice(item.key.indexOf(":") + 1);
    return {...item, key};
  }));
  return getInbox();
}

// Per-account flags (e.g. needsSignIn) for the popup to read. No-op without chrome.
export async function persistAccountState(state) {
  const store = storageLocal();
  if (!store) return;
  await store.set({ [ACCOUNT_STATE_KEY]: state });
}

export async function readAccountState() {
  const store = storageLocal();
  if (!store) return {};
  const data = await store.get(ACCOUNT_STATE_KEY);
  return data?.[ACCOUNT_STATE_KEY] ?? {};
}
