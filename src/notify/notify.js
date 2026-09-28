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

function storageLocal() {
  return globalThis.chrome?.storage?.local;
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
