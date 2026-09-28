// Service worker entry. Owns polling, cache writes, badge, and toasts.
// Popup reads the cache from chrome.storage.local only (Task 7).
//
// Auth arrives in Task 6, so tokens come through an injected token
// provider: getToken(account) and refreshToken(account). Nothing here
// imports auth; the chrome wiring at the bottom supplies the real
// provider later, tests supply fakes.

import { fetchGmailMessages } from "../providers/gmail.js";
import { fetchOutlookMessages } from "../providers/outlook.js";
import { mergeMessages, getInbox, pruneCache } from "../store/cache.js";
import {
  diffNewIds,
  unreadCount,
  groupByAccount,
  buildToast,
  sanitizeError,
  persistCache,
  hydrateCache,
  persistAccountState,
  readAccountState,
} from "../notify/notify.js";
import {
  shouldPlay,
  isMuted,
  getSoundSettings,
  playChime,
} from "../notify/sound.js";

export const ALARM_NAME = "mail-poll";
export const DEFAULT_POLL_MS = 60_000;
export const MIN_POLL_MS = 30_000;
export const MAX_POLL_MS = 5 * 3600 * 1000;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 10 * 60_000;

// Account shape: { provider: "gmail"|"outlook", account: "a@b.c", enabled? }.
// Absent `enabled` means enabled.
const fetchers = { gmail: fetchGmailMessages, outlook: fetchOutlookMessages };

const backoffByKey = new Map(); // accountKey -> { failures, nextAllowedAt }
const needsSignInByKey = new Set();

export function accountKey(acct) {
  return `${acct.provider}:${acct.account}`;
}

export function clampInterval(ms) {
  return Math.min(MAX_POLL_MS, Math.max(MIN_POLL_MS, ms ?? DEFAULT_POLL_MS));
}

export function isEnabled(acct) {
  return acct.enabled !== false;
}

export function needsSignInFor(acct) {
  return needsSignInByKey.has(accountKey(acct));
}

function markNeedsSignIn(acct) {
  needsSignInByKey.add(accountKey(acct));
}

export function clearNeedsSignIn(acct) {
  needsSignInByKey.delete(accountKey(acct));
}

// Restore persisted per-account flags (e.g. needsSignIn) into memory.
// Runs as part of init; exported so tests can simulate a restart.
export async function hydrateAccountState() {
  const stored = await readAccountState();
  for (const [key, value] of Object.entries(stored ?? {})) {
    if (value?.needsSignIn) needsSignInByKey.add(key);
    else needsSignInByKey.delete(key);
  }
}

function isBackingOff(acct, now) {
  return (backoffByKey.get(accountKey(acct))?.nextAllowedAt ?? 0) > now;
}

function recordBackoff(acct, now) {
  const key = accountKey(acct);
  const failures = (backoffByKey.get(key)?.failures ?? 0) + 1;
  const delay = Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
  backoffByKey.set(key, { failures, nextAllowedAt: now + delay });
  return { failures, retryAt: now + delay };
}

function clearBackoff(acct) {
  backoffByKey.delete(accountKey(acct));
}

function isRateOrServer(status) {
  return status === 429 || (status !== undefined && status >= 500);
}

// Poll one account. Never throws: every outcome is a result object so one
// failed account cannot block the others in pollAll.
export async function pollAccount(acct, deps) {
  const now = deps.now ?? Date.now();
  const key = accountKey(acct);
  if (!isEnabled(acct)) return { key, skipped: true };
  if (isBackingOff(acct, now)) {
    return { key, backedOff: true, retryAt: backoffByKey.get(key).nextAllowedAt };
  }
  const fetcher = deps.fetchers?.[acct.provider] ?? fetchers[acct.provider];
  if (!fetcher) return { key, error: `unknown provider ${acct.provider}` };

  let token;
  try {
    token = await deps.getToken(acct);
  } catch (err) {
    return { key, error: sanitizeError(err, acct) };
  }

  try {
    const items = await fetcher(token, deps.since);
    clearBackoff(acct);
    clearNeedsSignIn(acct);
    return { key, items };
  } catch (err) {
    if (err?.status === 401 && deps.refreshToken) {
      // One silent refresh, one retry. The needs-sign-in flag is reserved
      // for auth failures; transient retry errors back off instead.
      let fresh;
      try {
        fresh = await deps.refreshToken(acct);
      } catch (refreshErr) {
        markNeedsSignIn(acct);
        return { key, needsSignIn: true, error: sanitizeError(refreshErr, acct) };
      }
      try {
        const items = await fetcher(fresh, deps.since);
        clearBackoff(acct);
        clearNeedsSignIn(acct);
        return { key, items, refreshed: true };
      } catch (retryErr) {
        if (isRateOrServer(retryErr?.status)) {
          const { retryAt } = recordBackoff(acct, now);
          return { key, backedOff: true, retryAt, refreshed: true, error: sanitizeError(retryErr, acct) };
        }
        if (retryErr?.status === 401) {
          markNeedsSignIn(acct);
          return { key, needsSignIn: true, error: sanitizeError(retryErr, acct) };
        }
        return { key, refreshed: true, error: sanitizeError(retryErr, acct) };
      }
    }
    if (isRateOrServer(err?.status)) {
      const { retryAt } = recordBackoff(acct, now);
      return { key, backedOff: true, retryAt, error: sanitizeError(err, acct) };
    }
    return { key, error: sanitizeError(err, acct) };
  }
}

// Poll every account concurrently, merge successes, update badge, toast once
// per account with new mail (never on manual refresh), persist the cache.
// Returns a summary; never throws.
export async function pollAll(accounts, deps = {}) {
  const now = deps.now ?? Date.now();
  const manual = deps.manual === true;
  const oldKeys = getInbox().map((i) => i.key);

  const settled = await Promise.all(
    accounts.map((acct) =>
      pollAccount(acct, { ...deps, now }).catch((error) => ({ key: accountKey(acct), error })),
    ),
  );

  const fetched = [];
  for (const r of settled) {
    // Zero-item polls contribute nothing; mergeMessages keeps the stale cache.
    if (r.items?.length) fetched.push(...r.items);
  }
  if (fetched.length) mergeMessages(fetched);
  pruneCache(now);
  const inbox = getInbox();

  const enabledSet = new Set(accounts.filter(isEnabled).map(accountKey));
  const badge = unreadCount(inbox.filter((i) => enabledSet.has(`${i.provider}:${i.account}`)));

  const newIds = new Set(diffNewIds(oldKeys, inbox.map((i) => i.key)));
  const newItems = inbox.filter((i) => newIds.has(i.key));
  const failures = settled.filter((r) => r.error && !r.backedOff && !r.needsSignIn);
  if (failures.length && deps.onError) {
    for (const f of failures) deps.onError(f);
  }

  const notify = deps.notify ?? sendNotification;
  const setBadge = deps.setBadge ?? defaultSetBadge;
  if (!manual && newItems.length) {
    for (const group of groupByAccount(newItems)) {
      await notify(group, buildToast(group));
    }
  }
  // New-mail chime: automatic polls with new mail only, never manual
  // refresh. Mute plus volume come from storage so the worker and the
  // popup read the same settings. Sound never breaks polling and never
  // carries mail content: playSound receives only the volume level.
  if (!manual && newItems.length) {
    try {
      const readSettings = deps.readSoundSettings ?? getSoundSettings;
      const settings = await readSettings();
      const keys = newItems.map((i) => `${i.provider}:${i.account}`);
      if (shouldPlay({ manual, muted: isMuted(settings, keys), dnd: deps.dnd === true })) {
        const playSound = deps.playSound ?? playChime;
        await playSound(settings.volume);
      }
    } catch {
      // Silent by design; no mail content in logs.
    }
  }
  await setBadge(badge);
  await persistCache(inbox);
  // Merge with stored flags so accounts absent from this poll keep theirs.
  const mergedState = await readAccountState();
  for (const a of accounts) {
    mergedState[accountKey(a)] = { needsSignIn: needsSignInFor(a) };
  }
  await persistAccountState(mergedState);

  return {
    badge,
    newIds: [...newIds],
    succeeded: settled.filter((r) => r.items !== undefined).map((r) => r.key),
    backedOff: settled.filter((r) => r.backedOff).map((r) => r.key),
    needsSignIn: settled.filter((r) => r.needsSignIn).map((r) => r.key),
    failed: failures.map((r) => r.key),
  };
}

// Packaged icon for toasts. Chrome requires iconUrl; without it the
// create() rejection is swallowed and real toasts silently never appear.
export const NOTIFICATION_ICON = "src/notify/icon.png";

function notificationIconUrl() {
  try {
    return globalThis.chrome?.runtime?.getURL?.(NOTIFICATION_ICON) ?? NOTIFICATION_ICON;
  } catch {
    return NOTIFICATION_ICON;
  }
}

export function sendNotification(group, toast) {
  const chromeNotify = globalThis.chrome?.notifications;
  if (!chromeNotify) return Promise.resolve();
  const result = chromeNotify.create(`${accountKey(group)}:${Date.now()}`, {
    type: "basic",
    iconUrl: notificationIconUrl(),
    title: toast.title,
    message: toast.message,
  });
  return result?.catch?.(() => {}) ?? Promise.resolve();
}

function defaultSetBadge(count) {
  const action = globalThis.chrome?.action;
  if (!action) return Promise.resolve();
  return Promise.all([
    action.setBadgeText({ text: count > 0 ? String(count) : "" }),
    action.setBadgeBackgroundColor({ color: "#1a73e8" }),
  ]).then(() => {}).catch(() => {});
}

// ---- chrome wiring (inactive under Node: typeof chrome is "undefined") ----

async function loadAccounts() {
  const data = await globalThis.chrome?.storage?.local?.get?.("accounts");
  return data?.accounts ?? [];
}

function defaultTokenProvider() {
  return {
    // Task 6 replaces these with real identity/auth flows.
    getToken: async () => {
      throw new Error("no token provider: auth arrives in Task 6");
    },
    refreshToken: async () => {
      throw new Error("no token provider: auth arrives in Task 6");
    },
  };
}

async function ensureAlarm() {
  const alarms = globalThis.chrome?.alarms;
  if (!alarms) return;
  const stored = await globalThis.chrome?.storage?.local?.get?.("pollIntervalMs");
  await alarms.create(ALARM_NAME, {
    periodInMinutes: clampInterval(stored?.pollIntervalMs ?? DEFAULT_POLL_MS) / 60000,
  });
}

// One initialization promise created at worker evaluation. Every polling
// entry point awaits it, so an alarm or message that wakes a terminated
// worker hydrates memory from storage before polling — never polling with
// an empty cache, never persisting an empty inbox over stored mail.
async function init() {
  await hydrateCache();
  await hydrateAccountState();
  await ensureAlarm();
}

export const ready = init();

async function start() {
  await ready;
  const accounts = await loadAccounts();
  if (accounts.length) {
    await pollAll(accounts, { ...defaultTokenProvider() });
  }
}

// Polling entry points. Each awaits ready first; tests drive these directly
// to simulate a fresh worker woken by an alarm with no startup events.
export async function handleAlarm(accounts, deps = {}) {
  await ready;
  return pollAll(accounts, deps);
}

export async function handleManualRefresh(accounts, deps = {}) {
  await ready;
  return pollAll(accounts, { ...deps, manual: true });
}

if (typeof chrome !== "undefined" && chrome?.alarms) {
  chrome.runtime?.onStartup?.addListener(() => void start());
  chrome.runtime?.onInstalled?.addListener(() => void start());
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm?.name !== ALARM_NAME) return;
    void (async () => {
      const accounts = await loadAccounts();
      await handleAlarm(accounts, { ...defaultTokenProvider() });
    })();
  });
  chrome.runtime?.onMessage?.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "refresh") return false;
    void (async () => {
      const accounts = await loadAccounts();
      const summary = await handleManualRefresh(accounts, { ...defaultTokenProvider() });
      sendResponse?.({ ok: true, badge: summary.badge });
    })();
    return true;
  });
}
