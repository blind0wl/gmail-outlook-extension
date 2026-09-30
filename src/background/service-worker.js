// Service worker entry. Owns polling, cache writes, badge, and toasts.
// Popup reads the cache from chrome.storage.local only (Task 7).
//
// Tokens come from the real Task 6 flows through buildTokenProvider:
// per account, getToken resolves the account-bound credential silently and
// refreshToken evicts the rejected credential and renews it (both
// interactive:false). Interactive recovery passes the same account identity
// through handleSignIn. Tests supply fakes via deps.

import { fetchGmailMessages } from "../providers/gmail.js";
import { fetchOutlookMessages } from "../providers/outlook.js";
import {
  getGraphTokenForAccount,
  renewGraphToken,
  clearGraphToken,
  configureMicrosoftAuth,
  defaultAppId,
} from "../auth/microsoft.js";
import {
  accountKey,
  getMicrosoftClientId,
  loadAccounts,
  saveAccounts,
  normalizeAccount,
} from "../store/accounts.js";
import {
  mergeMessages,
  getInbox,
  pruneCache,
  reconcileAccount,
  setLocalRead,
} from "../store/cache.js";
import {
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
const baselineByKey = new Set();
const seenByKey = new Map();
const signedOutByKey = new Set();
const accountGeneration = new Map();
let writerTail = Promise.resolve();
function write(op) {
  const run = writerTail.then(op, op);
  writerTail = run.catch(() => {});
  return run;
}
let pollTail = Promise.resolve();
const offlineByKey = new Set(); // accountKey -> last fetch failed with no HTTP status while offline

export { accountKey };

export function clampInterval(ms) {
  return Math.min(MAX_POLL_MS, Math.max(MIN_POLL_MS, ms ?? DEFAULT_POLL_MS));
}

export function isEnabled(acct) {
  return acct.enabled !== false;
}

export function needsSignInFor(acct) {
  return needsSignInByKey.has(accountKey(acct));
}

export function isOfflineFor(acct) {
  return offlineByKey.has(accountKey(acct));
}

function isOfflineNow() {
  try {
    return globalThis.navigator?.onLine === false;
  } catch {
    return false;
  }
}

// Status-less failures with no HTTP exchange. navigator.onLine is
// unreliable inside service workers (it can stay true with the cable
// unplugged), so the adapters mark never-reached-a-server at the source
// with an -offline op suffix; aborts keep the base op and stay generic.
// Fixed diagnostic code for a sign-in failure: lets the popup show
// *which step* failed when there is no HTTP status to display.
function signInCode(err) {
  if (err?.transient) return "transient";
  const message = String(err?.message ?? "");
  if (/clientId not configured/.test(message)) return "no-client-id";
  if (/chrome.identity missing|auth unavailable/.test(message))
    return "no-identity";
  if (/cancelled or failed|sign in threw/.test(message))
    return "flow-cancelled";
  if (/token exchange/.test(message)) {
    // err.code carries the endpoint's own identifiers
    // (error name + AADSTS number), safe to display.
    const detail = String(err?.code ?? "").replace(/[^a-zA-Z0-9/_-]/g, "");
    return detail ? `token-exchange/${detail}` : "token-exchange";
  }
  if (/mismatch/.test(message)) return "account-mismatch";
  if (/needs sign in|AUTH_REQUIRED|auth needs sign in/.test(message))
    return "auth-required";
  return "unknown";
}

function isOfflineError(err) {
  if (err?.status !== undefined) return false;
  if (isOfflineNow()) return true;
  return typeof err?.op === "string" && err.op.endsWith("-offline");
}

function markNeedsSignIn(acct) {
  // Proven authentication failure. Offline state is preserved: only call
  // sites with an HTTP response in hand clear it via clearOffline.
  needsSignInByKey.add(accountKey(acct));
}

function markOffline(acct) {
  offlineByKey.add(accountKey(acct));
}

function clearOffline(acct) {
  offlineByKey.delete(accountKey(acct));
}

export function clearNeedsSignIn(acct) {
  needsSignInByKey.delete(accountKey(acct));
}

// Restore persisted per-account flags (needsSignIn, offline) into memory.
// Runs as part of init; exported so tests can simulate a restart.
// Retry deadlines and failure counts survive worker termination.
export async function hydrateAccountState() {
  const stored = await readAccountState();
  for (const [key, value] of Object.entries(stored ?? {})) {
    if (value?.baseline) baselineByKey.add(key);
    if (Array.isArray(value?.seen)) seenByKey.set(key, value.seen);
    if (value?.signedOut) signedOutByKey.add(key);
    if (value?.retryAt)
      backoffByKey.set(key, {
        failures: value.failures ?? 1,
        nextAllowedAt: value.retryAt,
      });
    if (value?.needsSignIn) needsSignInByKey.add(key);
    else needsSignInByKey.delete(key);
    if (value?.offline) offlineByKey.add(key);
    else offlineByKey.delete(key);
  }
}

function isBackingOff(acct, now) {
  return (backoffByKey.get(accountKey(acct))?.nextAllowedAt ?? 0) > now;
}

function recordBackoff(acct, now) {
  const key = accountKey(acct);
  // Backoff follows an HTTP response, so we are online.
  offlineByKey.delete(key);
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
  if (signedOutByKey.has(key)) return { key, needsSignIn: true, skipped: true };
  if (!isEnabled(acct)) return { key, skipped: true };
  if (isBackingOff(acct, now)) {
    return {
      key,
      backedOff: true,
      retryAt: backoffByKey.get(key).nextAllowedAt,
    };
  }
  const fetcher = deps.fetchers?.[acct.provider] ?? fetchers[acct.provider];
  if (!fetcher) return { key, error: `unknown provider ${acct.provider}` };

  let token;
  try {
    token = await deps.getToken(acct);
  } catch (err) {
    // Acquisition failures are classified, not blanket sign-in: offline
    // stays offline (other flags preserved), transient blips stay generic
    // errors, only authentication failures offer the Sign in button.
    if (isOfflineNow()) {
      markOffline(acct);
      return { key, offline: true, error: sanitizeError(err, acct) };
    }
    if (isRateOrServer(err?.status)) {
      return {
        key,
        backedOff: true,
        ...recordBackoff(acct, now),
        error: sanitizeError(err, acct),
      };
    }
    if (err?.transient) {
      return { key, error: sanitizeError(err, acct) };
    }
    markNeedsSignIn(acct);
    return { key, needsSignIn: true, error: sanitizeError(err, acct) };
  }

  try {
    const items = await fetcher(token, deps.since ?? now - 7 * 86400000, acct?.account);
    clearBackoff(acct);
    clearNeedsSignIn(acct);
    clearOffline(acct);
    return { key, items };
  } catch (err) {
    // Any HTTP response proves we are online, even an error status.
    if (typeof err?.status === "number") clearOffline(acct);
    if (err?.status === 401 && deps.refreshToken) {
      // One forced renewal, one retry. The rejected token is passed along
      // so renewal evicts and replaces it instead of returning it again.
      // The needs-sign-in flag is reserved for auth failures; transient
      // retry errors back off instead.
      let fresh;
      try {
        fresh = await deps.refreshToken(acct, token);
      } catch (refreshErr) {
        if (isOfflineNow()) {
          markOffline(acct);
          return { key, offline: true, error: sanitizeError(refreshErr, acct) };
        }
        if (isRateOrServer(refreshErr?.status)) {
          return {
            key,
            backedOff: true,
            ...recordBackoff(acct, now),
            error: sanitizeError(refreshErr, acct),
          };
        }
        if (refreshErr?.transient) {
          return {
            key,
            refreshed: true,
            error: sanitizeError(refreshErr, acct),
          };
        }
        clearOffline(acct);
        markNeedsSignIn(acct);
        return {
          key,
          needsSignIn: true,
          error: sanitizeError(refreshErr, acct),
        };
      }
      try {
        const items = await fetcher(fresh, deps.since ?? now - 7 * 86400000, acct?.account);
        clearBackoff(acct);
        clearNeedsSignIn(acct);
        clearOffline(acct);
        return { key, items, refreshed: true };
      } catch (retryErr) {
        if (isRateOrServer(retryErr?.status)) {
          const { retryAt } = recordBackoff(acct, now);
          return {
            key,
            backedOff: true,
            retryAt,
            refreshed: true,
            error: sanitizeError(retryErr, acct),
          };
        }
        if (retryErr?.status === 401) {
          clearOffline(acct);
          markNeedsSignIn(acct);
          return {
            key,
            needsSignIn: true,
            error: sanitizeError(retryErr, acct),
          };
        }
        if (typeof retryErr?.status === "number") clearOffline(acct);
        return { key, refreshed: true, error: sanitizeError(retryErr, acct) };
      }
    }
    if (isRateOrServer(err?.status)) {
      const { retryAt } = recordBackoff(acct, now);
      return { key, backedOff: true, retryAt, error: sanitizeError(err, acct) };
    }
    if (isOfflineError(err)) {
      // No HTTP status and either the browser reports offline or the
      // adapter never reached a server: keep the stale cache visible
      // and let the popup show its offline note.
      markOffline(acct);
      return { key, offline: true, error: sanitizeError(err, acct) };
    }
    return { key, error: sanitizeError(err, acct) };
  }
}

// Poll every account concurrently, merge successes, update badge, toast once
// per account with new mail (never on manual refresh), persist the cache.
// Returns a summary; never throws.
export function pollAll(accounts, deps = {}) {
  // Serialize complete poll cycles. Account commits use the shared writer,
  // so a slow account cannot block mark-read or completed accounts.
  const run = pollTail.then(() => runPoll(accounts, deps));
  pollTail = run.catch(() => {});
  return run;
}

async function focusedProvider() {
  try {
    const window = await chrome.windows.getLastFocused();
    if (!window.focused) return null;
    const [tab] = await chrome.tabs.query({
      active: true,
      windowId: window.id,
    });
    const host = new URL(tab?.url).hostname;
    if (host === "mail.google.com") return "gmail";
    if (host === "outlook.live.com") return "outlook";
  } catch {
    /* Tab details may be unavailable. */
  }
  return null;
}

async function badgeFor(accounts, deps = {}) {
  const enabled = new Set(
    accounts
      .filter((a) => isEnabled(a) && !signedOutByKey.has(accountKey(a)))
      .map(accountKey),
  );
  const count = unreadCount(
    getInbox().filter((i) => enabled.has(accountKey(i))),
  );
  await (deps.setBadge ?? defaultSetBadge)(count);
  return count;
}

export async function handleMarkRead(key, accounts, deps = {}) {
  await ready;
  return write(async () => {
    setLocalRead(key);
    await persistCache(getInbox());
    return { ok: true, badge: await badgeFor(accounts, deps) };
  });
}

async function runPoll(accounts, deps) {
  const now = deps.now ?? Date.now();
  const newIds = [];
  let badge = 0;
  const settled = await Promise.all(
    accounts.map(async (acct) => {
      const key = accountKey(acct);
      const generation = accountGeneration.get(key) ?? 0;
      const result = await pollAccount(acct, { ...deps, now }).catch(
        (error) => ({ key, error: sanitizeError(error, acct) }),
      );
      await write(async () => {
        if (generation !== (accountGeneration.get(key) ?? 0)) return;
        const old = new Set([
          ...(seenByKey.get(key) ?? []),
          ...getInbox().map((i) => i.key),
        ]);
        // Existing cache also establishes a baseline when upgrading.
        const baseline =
          baselineByKey.has(key) ||
          getInbox().some((i) => accountKey(i) === key);
        if (result.items !== undefined) {
          reconcileAccount(acct, result.items, result.items.complete !== false);
          baselineByKey.add(key);
          seenByKey.set(
            key,
            [
              ...new Set([
                ...result.items.map((i) => i.key),
                ...(seenByKey.get(key) ?? []),
              ]),
            ].slice(0, 200),
          );
        }
        pruneCache(now);
        const fresh = getInbox().filter(
          (i) => accountKey(i) === key && !old.has(i.key),
        );
        newIds.push(...fresh.map((i) => i.key));
        await persistCache(getInbox());
        await storeAccountEntries([acct], new Map([[key, result]]), now);
        badge = await badgeFor(accounts, deps);
        const eligible = fresh.filter((i) => i.unread && !i.localRead);
        const settings = await globalThis.chrome?.storage?.local?.get(
          "skipFocusedProvider",
        );
        // Focused-provider suppression is opt-in: only an explicit true
        // silences alerts for the focused provider. Default alerts even
        // while looking at the mailbox.
        const focused =
          settings?.skipFocusedProvider === true
            ? await (deps.focusedProvider ?? focusedProvider)()
            : null;
        if (
          !signedOutByKey.has(key) &&
          generation === (accountGeneration.get(key) ?? 0) &&
          baseline &&
          !deps.manual &&
          acct.notify !== false &&
          focused !== acct.provider &&
          eligible.length &&
          !deps.dnd
        ) {
          for (const group of groupByAccount(eligible))
            await (deps.notify ?? sendNotification)(group, buildToast(group));
          try {
            const settings = await (
              deps.readSoundSettings ?? getSoundSettings
            )();
            if (
              shouldPlay({
                manual: false,
                muted: isMuted(settings, [key]),
                dnd: false,
              })
            ) {
              await (deps.playSound ?? playChime)(settings.volume);
            }
          } catch {
            /* Sound failure does not undo the cache commit. */
          }
        }
      });
      return result;
    }),
  );
  const failures = settled.filter(
    (r) => r.error && !r.backedOff && !r.needsSignIn && !r.offline,
  );
  for (const failure of failures) deps.onError?.(failure);
  return {
    badge,
    newIds,
    succeeded: settled.filter((r) => r.items !== undefined).map((r) => r.key),
    backedOff: settled.filter((r) => r.backedOff).map((r) => r.key),
    needsSignIn: settled.filter((r) => r.needsSignIn).map((r) => r.key),
    offline: settled.filter((r) => r.offline).map((r) => r.key),
    failed: failures.map((r) => r.key),
  };
}

// One persisted entry per account for the popup's error UI.
// Successful polls stamp checkedAt so the popup can show visible,
// per-account freshness; failures never move the stamp, so failed and
// paused accounts cannot look freshly checked.
function stateEntry(acct, result, now) {
  const key = accountKey(acct);
  const needsSignIn = signedOutByKey.has(key) || needsSignInByKey.has(key);
  const offline = offlineByKey.has(key);
  const backedOff = result?.backedOff === true;
  // Status-less online failures carry no retry or code marker of their own,
  // so they persist an explicit stale indicator instead of looking healthy.
  const stale = !!result?.error && !needsSignIn && !offline && !backedOff;
  return {
    needsSignIn,
    baseline: baselineByKey.has(key),
    seen: seenByKey.get(key) ?? [],
    signedOut: signedOutByKey.has(key),
    failures: backoffByKey.get(key)?.failures ?? 0,
    offline,
    backedOff,
    ...(stale ? { stale: true } : {}),
    ...(result?.items !== undefined && now ? { checkedAt: now } : {}),
    ...(result?.retryAt ? { retryAt: result.retryAt } : {}),
    ...(typeof result?.error?.status === "number"
      ? { status: result.error.status }
      : {}),
  };
}

async function storeAccountEntries(accounts, resultsByKey, now) {
  const merged = await readAccountState();
  for (const a of accounts) {
    const key = accountKey(a);
    merged[key] = stateEntry(a, resultsByKey.get(key), now);
  }
  await persistAccountState(merged);
}

// Packaged icon for toasts. Chrome requires iconUrl; without it the
// create() rejection is swallowed and real toasts silently never appear.
export const NOTIFICATION_ICON = "src/notify/icon.png";

function notificationIconUrl() {
  try {
    return (
      globalThis.chrome?.runtime?.getURL?.(NOTIFICATION_ICON) ??
      NOTIFICATION_ICON
    );
  } catch {
    return NOTIFICATION_ICON;
  }
}

export function sendNotification(group, toast) {
  const chromeNotify = globalThis.chrome?.notifications;
  if (!chromeNotify) return Promise.resolve();
  const result = chromeNotify.create(`${accountKey(group)}:${Date.now()}`, {
    type: "basic",
    silent: true,
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
  ])
    .then(() => {})
    .catch(() => {});
}

// ---- real token wiring (Task 6 flows, silent from the worker) ----

let lastConfiguredClientId = null;

// Per-account silent tokens backed by the real Task 6 flows, always
// interactive:false so a background poll never pops a sign-in window.
// The stable account identity travels the whole path: gmail resolves its
// credential through the account-bound record (verified, never the wrong
// mailbox), outlook through its per-account session slot. The Microsoft
// side is configured once from the Entra app id on the account record (a
// public identifier, never a secret).
export function ensureMicrosoftConfigured(accounts = []) {
  const clientId =
    getMicrosoftClientId(accounts ?? []) ?? defaultAppId();
  if (clientId && clientId !== lastConfiguredClientId) {
    try {
      configureMicrosoftAuth({ clientId });
      lastConfiguredClientId = clientId;
    } catch {
      // Per-account errors surface at poll time; never break wiring here.
    }
  }
  return clientId;
}

export function buildTokenProvider(accounts = []) {
  const clientId = ensureMicrosoftConfigured(accounts);
  return {
    getToken: (acct) => silentTokenFor(acct, clientId),
    refreshToken: (acct, rejectedToken) =>
      renewTokenFor(acct, rejectedToken, clientId),
  };
}

function silentTokenFor(acct, clientId) {
  if (acct?.provider === "outlook") {
    return getGraphTokenForAccount(acct?.account ?? "", false, {
      clientId: acct.clientId ?? clientId,
    });
  }
  if (acct?.provider === "gmail") {
    // Feed transport uses the browser session cookie; no credential exists.
    return null;
  }
  return Promise.reject(new Error(`unknown provider ${acct?.provider}`));
}

// Forced renewal after a 401: evict the rejected credential and refetch
// silently. Renewal failure throws AUTH_REQUIRED (caller drives the
// Sign in button) or a transient-marked error (generic retry next poll).
function renewTokenFor(acct, rejectedToken, clientId) {
  if (acct?.provider === "outlook") {
    return renewGraphToken(acct?.account ?? "", rejectedToken, {
      clientId: acct.clientId ?? clientId,
    });
  }
  if (acct?.provider === "gmail") {
    // Nothing to renew for cookie transport; the retry refetches.
    return null;
  }
  return Promise.reject(new Error(`unknown provider ${acct?.provider}`));
}

// Fill missing token callbacks with the real silent provider. Explicit
// test doubles always win via the spread.
function withRealTokens(accounts, deps = {}) {
  const real = buildTokenProvider(accounts ?? []);
  return { getToken: real.getToken, refreshToken: real.refreshToken, ...deps };
}

async function ensureAlarm() {
  const alarms = globalThis.chrome?.alarms;
  if (!alarms) return;
  const stored =
    await globalThis.chrome?.storage?.local?.get?.("pollIntervalMs");
  await alarms.create(ALARM_NAME, {
    periodInMinutes:
      clampInterval(stored?.pollIntervalMs ?? DEFAULT_POLL_MS) / 60000,
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
    await pollAll(accounts, withRealTokens(accounts));
  }
}

// Interactive recovery for one account, driven by the popup's sign-in
// button: one visible auth flow, then an immediate silent poll so the
// account recovers without waiting for the next alarm. Other accounts
// are untouched. Returns the poll result; never throws.
export async function handleSignIn(accounts, target, deps = {}) {
  await ready;
  const list = accounts ?? [];
  const acct =
    list.find(
      (a) =>
        a?.provider === target?.provider &&
        (a?.account ?? a?.address) === (target?.account ?? target?.address),
    ) ?? target;
  const key = accountKey(acct);
  const generation = accountGeneration.get(key) ?? 0;
  const { interactiveGet, ...pollDeps } = deps;
  // Configure Microsoft before any interactive callback: on a fresh worker
  // this is the first event, and the graph flow would otherwise reject
  // "clientId not configured" before authenticating.
  const clientId = ensureMicrosoftConfigured([...list, target]);
  const interactive =
    interactiveGet ??
    ((a) => {
      if (a?.provider === "gmail") {
        // No credential step for Gmail: the poll below proves the
        // session. The login tab opens only if the poll fails auth.
        return null;
      }
      return getGraphTokenForAccount(a?.account ?? "", true, {
        // ||, not ??: a stored "" must fall through to the default.
        clientId: a.clientId || clientId,
      });
    });
  try {
    await interactive(acct);
  } catch (err) {
    if (generation !== (accountGeneration.get(key) ?? 0))
      return { key, needsSignIn: true };
    if (isRateOrServer(err?.status)) {
      const result = {
        key,
        backedOff: true,
        ...recordBackoff(acct, deps.now ?? Date.now()),
        error: sanitizeError(err, acct),
      };
      await write(() => storeAccountEntries([acct], new Map([[key, result]])));
      return result;
    }
    if (isOfflineNow()) {
      markOffline(acct);
      const offlineResult = {
        key,
        offline: true,
        error: sanitizeError(err, acct),
      };
      await write(() =>
        storeAccountEntries([acct], new Map([[key, offlineResult]])),
      );
      return offlineResult;
    }
    if (err?.transient) {
      const transientResult = { key, error: sanitizeError(err, acct) };
      await write(() =>
        storeAccountEntries([acct], new Map([[key, transientResult]])),
      );
      return transientResult;
    }
    markNeedsSignIn(acct);
    // Short diagnostic code for the popup: the sanitized error keeps
    // status only, which leaves pre-popup failures (no status) mute.
    // Codes are fixed identifiers — never addresses, mail, or text.
    const failure = {
      key,
      needsSignIn: true,
      code: signInCode(err),
      error: sanitizeError(err, acct),
    };
    await write(() => storeAccountEntries([acct], new Map([[key, failure]])));
    return failure;
  }
  if (generation !== (accountGeneration.get(key) ?? 0))
    return { key, needsSignIn: true };
  signedOutByKey.delete(key);
  clearBackoff(acct);
  clearNeedsSignIn(acct);
  clearOffline(acct);
  const real = buildTokenProvider(list);
  // Serialize the recovery poll against alarm cycles on the shared poll
  // chain. A sign-in fetch starts only after earlier cycles committed, so
  // its complete reconcile can never wipe newer alarm mail (issue #2).
  const run = pollTail.then(() =>
    signInPoll(list, acct, key, generation, real, pollDeps),
  );
  pollTail = run.catch(() => {});
  return run;
}

async function signInPoll(list, acct, key, generation, real, pollDeps) {
  if (generation !== (accountGeneration.get(key) ?? 0))
    return { key, needsSignIn: true };
  const now = pollDeps.now ?? Date.now();
  const result = await pollAccount(acct, {
    getToken: real.getToken,
    refreshToken: real.refreshToken,
    ...pollDeps,
  }).catch((error) => ({ key, error: sanitizeError(error, acct) }));
  if (acct?.provider === "gmail" && result?.needsSignIn) {
    // handleSignIn runs only on explicit Add/Sign in clicks, so opening
    // the login tab here never spams: the user asked, the session is
    // missing, show them where to log in.
    try {
      void globalThis.chrome?.tabs?.create?.({
        url: "https://mail.google.com/",
      });
    } catch {}
  }
  await write(async () => {
    if (generation !== (accountGeneration.get(key) ?? 0)) return;
    if (result.items !== undefined) {
      reconcileAccount(acct, result.items, result.items.complete !== false);
      baselineByKey.add(key);
      seenByKey.set(key, result.items.map((i) => i.key).slice(0, 200));
      await persistCache(getInbox());
    }
    await storeAccountEntries([acct], new Map([[key, result]]), now);
    await badgeFor(list, pollDeps);
  });
  return result;
}

// Polling entry points. Each awaits ready first; tests drive these directly
// to simulate a fresh worker woken by an alarm with no startup events.
export async function handleAlarm(accounts, deps = {}) {
  await ready;
  return pollAll(accounts, withRealTokens(accounts, deps));
}

export async function handleManualRefresh(accounts, deps = {}) {
  await ready;
  return pollAll(accounts, { ...withRealTokens(accounts, deps), manual: true });
}

export async function handleMessage(msg, deps = {}) {
  await ready;
  if (msg.type === "refresh") {
    const result = await handleManualRefresh(await loadAccounts(), deps);
    // Per-account outcome lists let the popup report honest freshness:
    // which accounts were actually checked versus backed off, signed
    // out, offline, or failed. Never collapse this into a bare ok.
    return {
      ok: true,
      badge: result.badge,
      checked: {
        succeeded: result.succeeded,
        backedOff: result.backedOff,
        needsSignIn: result.needsSignIn,
        offline: result.offline,
        failed: result.failed,
      },
    };
  }
  if (msg.type === "mark-read")
    return handleMarkRead(msg.key, await loadAccounts(), deps);
  if (
    !["add-account", "sign-in", "sign-out", "remove-account"].includes(msg.type)
  )
    return { ok: false };
  const target = normalizeAccount({
    ...msg,
    account: String(msg.account ?? "")
      .trim()
      .toLowerCase(),
  });
  if (
    !["gmail", "outlook"].includes(target.provider) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.account)
  )
    return { ok: false };
  const key = accountKey(target);
  if (msg.type === "add-account") {
    await write(async () => {
      const accounts = await loadAccounts();
      if (accounts.some((a) => accountKey(a) === key))
        throw new Error("account already exists");
      await saveAccounts([...accounts, target]);
    });
  }
  const accounts = await loadAccounts();
  const acct = accounts.find((a) => accountKey(a) === key);
  if (!acct) return { ok: false };
  if (msg.type === "add-account" || msg.type === "sign-in") {
    const result = await handleSignIn(accounts, acct, deps);
    return {
      ok: !result.error && !result.needsSignIn && !result.offline,
      needsSignIn: !!result.needsSignIn,
      ...(result.code ? { code: result.code } : {}),
    };
  }
  accountGeneration.set(key, (accountGeneration.get(key) ?? 0) + 1);
  signedOutByKey.add(key);
  markNeedsSignIn(acct);
  // Invalidate provider operations immediately, before waiting for the writer.
  // Gmail keeps no credentials (session cookie transport), so sign-out
  // only stops polling; Outlook clears its session slots.
  const clearing =
    acct.provider === "gmail"
      ? Promise.resolve(true)
      : clearGraphToken(acct.account);
  const cleared = clearing.then(
    () => true,
    () => false,
  );
  await write(async () => {
    clearBackoff(acct);
    await storeAccountEntries([acct], new Map());
    if (msg.type === "remove-account") {
      await saveAccounts(
        (await loadAccounts()).filter((a) => accountKey(a) !== key),
      );
      reconcileAccount(acct, [], true);
      await persistCache(getInbox());
      const state = await readAccountState();
      delete state[key];
      await persistAccountState(state);
      baselineByKey.delete(key);
      seenByKey.delete(key);
    }
    await badgeFor(await loadAccounts(), deps);
  });
  return { ok: await cleared };
}

if (typeof chrome !== "undefined") {
  chrome.runtime?.onStartup?.addListener(() => void start());
  chrome.runtime?.onInstalled?.addListener(() => void start());
  chrome.alarms?.onAlarm?.addListener((alarm) => {
    if (alarm?.name === ALARM_NAME)
      void loadAccounts().then((accounts) => handleAlarm(accounts));
  });
  chrome.runtime?.onMessage?.addListener((msg, _sender, sendResponse) => {
    if (
      ![
        "refresh",
        "mark-read",
        "add-account",
        "sign-in",
        "sign-out",
        "remove-account",
      ].includes(msg?.type)
    )
      return false;
    handleMessage(msg).then(sendResponse, () => sendResponse({ ok: false }));
    return true;
  });
}
