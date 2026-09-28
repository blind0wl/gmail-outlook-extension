// Notification helpers plus the storage persistence bridge.
// Pure logic (diff, counts, toast shaping) lives here so it is testable
// under Node. The chrome.* calls are isolated in persistCache/hydrateCache
// and degrade to no-ops where chrome does not exist (Node tests, which
// stub globalThis.chrome with an in-memory double instead).

import { mergeMessages, getInbox } from "../store/cache.js";

// storage.local keys. Task 7 popup reads CACHE_KEY in this same shape.
export const CACHE_KEY = "mailCache";
export const ACCOUNT_STATE_KEY = "accountState";

// Keys present in newKeys that were not in oldKeys, in newKeys order.
export function diffNewIds(oldKeys, newKeys) {
  const seen = new Set(oldKeys);
  return newKeys.filter((k) => !seen.has(k));
}

// Server-unread items the user has not read locally.
export function unreadCount(items) {
  return items.filter((i) => i.unread && !i.localRead).length;
}

// One entry per provider+account, preserving first-seen order.
export function groupByAccount(items) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.provider}:${item.account}`;
    if (!groups.has(key)) {
      groups.set(key, { provider: item.provider, account: item.account, items: [] });
    }
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
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

// Boundary sanitizer for poll errors. Provider adapters already throw
// sanitized errors, but token callbacks and test fakes can throw anything
// (including mail content). Keep only permitted identifiers: HTTP status,
// account address, and a timestamp. Free-text messages are dropped.
export function sanitizeError(err, acct) {
  const status = typeof err?.status === "number" ? err.status : undefined;
  const clean = new Error(
    status !== undefined ? `poll failed: ${status}` : "poll failed",
  );
  clean.name = "PollError";
  if (status !== undefined) clean.status = status;
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
  if (state.needsSignIn) return `${address} — needs sign in`;
  if (state.offline) return `${address} — offline, showing saved mail`;
  if (state.backedOff) {
    const when = state.retryAt ? `retry ${formatRetryAt(state.retryAt)}` : "retry pending";
    const code = state.status !== undefined ? ` (${state.status})` : "";
    return `${address} — stale, ${when}${code}`;
  }
  if (state.status !== undefined || state.error) {
    const code = state.status !== undefined ? ` (${state.status})` : "";
    return `${address} — last poll failed${code}`;
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
  if (items.length) mergeMessages(items);
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
