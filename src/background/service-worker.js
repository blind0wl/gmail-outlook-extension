import { readGmailMessageBody } from "../providers/gmail-conversation-state.js";
import { DEFAULT_POLL_MS, MIN_POLL_MS, MAX_POLL_MS, normalizePollInterval, validPollInterval } from "../store/poll-settings.js";
import { gmailSession, mutateGmailConversation, mutateOutlookMessage, inspectOutlookMessage } from "../providers/mail-actions.js";
import { inspectGmailTrash } from "../providers/gmail-trash-verification.js";
import { messageIdOf } from "../popup/links.js";
// Service worker entry. Owns polling, cache writes, badge, and toasts.
// Popup reads the cache from chrome.storage.local only (Task 7).
//
// Tokens come from the real Task 6 flows through buildTokenProvider:
// per account, getToken resolves the account-bound credential silently and
// refreshToken evicts the rejected credential and renews it (both
// interactive:false). Interactive recovery passes the same account identity
// through handleSignIn. Tests supply fakes via deps.

import { fetchGmailMessages } from "../providers/gmail.js";
import { fetchOutlookMessages, fetchOutlookMessageBody } from "../providers/outlook.js";
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
  applyMailboxChange,
} from "../store/cache.js";
import {
  unreadCount,
  buildToast,
  sanitizeError,
  persistCache,
  hydrateCache,
  persistAccountState,
  readAccountState,
} from "../notify/notify.js";
import {
  isMuted,
  getSoundSettings,
  playChime,
  copyAuthCodeToClipboard,
} from "../notify/sound.js";
import { processFreshMail } from "../auth-codes/pipeline.js";
import { readAuthCodeAutoCopy, AUTH_CODE_AUTO_COPY_KEY } from "../auth-codes/settings.js";
import {
  savePendingAuthCode,
  getPendingAuthCode,
  mapNotificationToMessage,
  messageForNotification,
  removeNotificationMapping,
  clearAuthCodeRecords,
} from "../auth-codes/session.js";
import {
  addDemoEmails,
  AUTH_CODE_DEMO_ALARM,
  AUTH_CODE_DEMO_INBOX_KEY,
  AUTH_CODE_DEMO_SEQUENCE_KEY,
  AUTH_CODE_DEMO_SCENARIOS,
  clearDemoInbox,
  createDemoEmail,
  getDemoInbox,
  getDemoMessage,
} from "../auth-codes/demo.js";

export const ALARM_NAME = "mail-poll";
export { DEFAULT_POLL_MS, MIN_POLL_MS, MAX_POLL_MS };
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
const AUTH_CODE_NOTIFICATION_PREFIX = "auth-code:";
const DEMO_SEQUENCE_INTERVAL_SECONDS = 30;
let demoTail = Promise.resolve();
let demoGeneration = 0;
function serializeDemo(op) {
  const run = demoTail.then(op, op);
  demoTail = run.catch(() => {});
  return run;
}

export { accountKey };

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

async function badgeFor(accounts, deps = {}, inbox = getInbox()) {
  const enabled = new Set(
    accounts
      .filter((a) => isEnabled(a) && !signedOutByKey.has(accountKey(a)))
      .map(accountKey),
  );
  const count = unreadCount(
    inbox.filter((i) => enabled.has(accountKey(i))),
  );
  await (deps.setBadge ?? defaultSetBadge)(count);
  return count;
}

export async function handleMarkRead(key, accounts, deps = {}) {
  await ready;
  return write(async () => {
    setLocalRead(key);
    const inbox = getInbox();
    await persistCache(inbox);
    return { ok: true, badge: await badgeFor(accounts, deps, inbox) };
  });
}

// Durable pending records stop a worker restart from replaying an uncertain
// move. The same poll queue orders provider reads and writes; sign-out epochs
// are bumped immediately and checked again before cache commits.
const pendingMail = new Set();
const pendingUndos = new Map();
export const MAIL_ACTIONS_KEY = "mailActions";
const UNDO_MS = 10 * 60000;
async function mailJournal() {
  const stored = await globalThis.chrome?.storage?.local?.get(MAIL_ACTIONS_KEY);
  const records = stored?.[MAIL_ACTIONS_KEY];
  return records && typeof records === "object" && !Array.isArray(records) ? records : {};
}
async function saveJournal(journal) {
  await globalThis.chrome?.storage?.local?.set({ [MAIL_ACTIONS_KEY]: journal });
}

function lockItem(item) {
  return { key: item.key, provider: item.provider, account: item.account };
}
export async function pruneMailActions(now = Date.now()) {
  return write(async () => {
    const journal = await mailJournal();
    for (const [key, record] of Object.entries(journal)) {
      if (record.state === "undo" && record.expiresAt <= now) delete journal[key];
      else if (["pending", "uncertain"].includes(record.state) && !pendingMail.has(key)) record.item = lockItem(record.item);
    }
    await saveJournal(journal);
  });
}
async function patchMailAction(key, record, current = () => true) {
  return write(async () => {
    if (!current()) return;
    const journal = await mailJournal();
    if (!current()) return;
    if (record) journal[key] = record;
    else delete journal[key];
    await saveJournal(journal);
  });
}

// Explicit worker-console diagnostic. Static imports are required in MV3;
// no runtime message, mailbox mutation or acknowledgement is introduced.
export async function inspectSavedGmailTrash(deps = {}) {
  const run = pollTail.then(async () => {
    await ready;
    const journal = await mailJournal();
    const target = Object.values(journal).find(record => record?.item?.provider === "gmail"
      && record.action === "trash" && ["pending", "uncertain"].includes(record.state));
    if (!target) return { ok: false, code: "no-saved-target" };
    const accounts = await loadAccounts();
    const acct = accounts.find(account => accountKey(account) === accountKey(target.item));
    if (!acct || !isEnabled(acct) || signedOutByKey.has(accountKey(acct)))
      return { ok: false, code: "account-unavailable" };
    const generation = accountGeneration.get(accountKey(acct)) ?? 0;
    const id = target.id || messageIdOf(target.item.key);
    const result = await (deps.inspect ?? inspectGmailTrash)(acct.account, [id]);
    if (generation !== (accountGeneration.get(accountKey(acct)) ?? 0))
      return { ok: false, code: "account-changed", results: ["not-confirmed"] };
    return result;
  });
  pollTail = run.catch(() => {});
  try { return await run; }
  catch { return { ok: false, code: "verification-unavailable", results: ["not-confirmed"] }; }
}

globalThis.inspectSavedGmailTrash = () => inspectSavedGmailTrash();

export async function handleMailboxAction(msg, deps = {}) {
  if (!msg || !["read", "trash", "undo", "unread", "acknowledge"].includes(msg.action) || typeof msg.key !== "string") return { ok: false, code: "invalid-action" };
  if (msg.action === "undo" && pendingUndos.has(msg.key)) return pendingUndos.get(msg.key);
  if (pendingMail.has(msg.key)) return { ok: false, code: "pending" };
  pendingMail.add(msg.key);
  const run = pollTail.then(async () => {
    await ready;
    const accounts = await loadAccounts();
    const journal = await mailJournal();
    const prior = journal[msg.key];
    if (msg.action === "undo" && !prior) return { ok: false, code: "undo-expired" };
    if (!prior && Object.keys(journal).length >= 200) return { ok: false, code: "check-mailbox" };
    const item = ["undo", "acknowledge"].includes(msg.action) ? prior?.item : getInbox().find(i => i.key === msg.key);
    const acct = accounts.find(a => item && accountKey(a) === accountKey(item));
    if (!acct || !isEnabled(acct) || signedOutByKey.has(accountKey(acct))) return { ok: false, code: "sign-in" };
    if (msg.action === "acknowledge") {
      // The poll queue serializes journal changes. Unrelated queued actions
      // must not prevent the user from releasing this conversation's lock.
      if (!prior) return { ok: false, code: "pending" };
      if (!["pending", "uncertain"].includes(prior.state)) return { ok: false, code: "check-mailbox" };
      // Account recovery checks a snapshot; another popup may have replaced a
      // lock meanwhile. Never acknowledge a later action on the same mail.
      if (msg.expectedExpiresAt !== undefined && msg.expectedExpiresAt !== (prior.expiresAt ?? null)) return { ok: false, code: "check-mailbox" };
      await patchMailAction(msg.key, null);
      return { ok: true };
    }
    if (prior?.state === "pending" || prior?.state === "uncertain") return { ok: false, code: "check-mailbox" };
    if (msg.action === "undo" && (!prior || prior.expiresAt <= Date.now() || prior.state !== "undo")) return { ok: false, code: "undo-expired" };
    const generation = accountGeneration.get(accountKey(acct)) ?? 0;
    const current = () => generation === (accountGeneration.get(accountKey(acct)) ?? 0);
    const id = msg.action === "undo" ? prior.id : messageIdOf(item.key);
    let token;
    let confirmed = false;
    let folder = prior?.folder ?? "inbox";
    try {
      token = await (deps.getToken ?? buildTokenProvider(accounts).getToken)(acct);
      if (acct.provider === "outlook" && msg.action === "trash") {
        const metadata = await (deps.inspect ?? inspectOutlookMessage)(token, id);
        if (!metadata?.parentFolderId) return { ok: false, code: "unavailable" };
        folder = metadata.parentFolderId;
      }
      if (!current()) return { ok: false, code: "sign-in" };
      journal[msg.key] = { state: "pending", action: msg.action, id, folder, item, expiresAt: Date.now() + UNDO_MS };
      await patchMailAction(msg.key, journal[msg.key], current);
      if (!current()) return { ok: false, code: "sign-in" };
      const mutate = deps.mutate ?? ((a, targetId, action, originalFolder) => a.provider === "gmail"
        ? mutateGmailConversation(a.account, targetId, action, () => { if (!current()) throw Error("superseded"); })
        : mutateOutlookMessage(token, targetId, action, originalFolder, () => { if (!current()) throw Error("superseded"); }));
      const result = await mutate(acct, id, msg.action, folder);
      confirmed = true;
      if (!current()) return { ok: false, code: "check-mailbox" };
      await write(async () => {
        if (!current()) return;
        const latest = await mailJournal();
        if (!current()) return;
        if (msg.action === "trash") latest[msg.key] = { ...journal[msg.key], state: "undo", id: result.id };
        else delete latest[msg.key];
        const replacement = { ...item, key: item.provider + ":" + encodeURIComponent(item.account) + ":" + result.id };
        if (msg.action === "undo") delete replacement.webLink;
        applyMailboxChange(msg.key, msg.action, replacement);
        const inbox = getInbox();
        await persistCache(inbox);
        await saveJournal(latest);
        await badgeFor(accounts, deps, inbox);
      });
      return current() ? { ok: true } : { ok: false, code: "check-mailbox" };
    } catch (error) {
      if (confirmed) error.uncertain = true;
      if (!current()) return { ok: false, code: "check-mailbox" };
      if (journal[msg.key]?.state === "pending") {
        if (error.uncertain) journal[msg.key] = { ...journal[msg.key], state: "uncertain", item: lockItem(item) };
        else if (msg.action === "undo") journal[msg.key] = prior;
        else delete journal[msg.key];
        await patchMailAction(msg.key, journal[msg.key], current);
      }
      if (acct.provider === "gmail" && error.uncertain && error.unreadInboxAbsent && msg.action !== "undo") {
        await write(async () => {
          if (!current()) return;
          // Remove only the verified absent card; keep the journal lock since
          // unread-feed absence does not establish a successful Trash move.
          applyMailboxChange(msg.key, "trash");
          const inbox = getInbox();
          await persistCache(inbox);
          await badgeFor(accounts, deps, inbox);
        });
      }
      return { ok: false, code: error.uncertain ? "check-mailbox" : error.code ?? "unavailable" };
    }
  });
  pollTail = run.catch(() => {});
  const completion = run.finally(() => {
    pendingMail.delete(msg.key);
    pendingUndos.delete(msg.key);
  });
  if (msg.action === "undo") pendingUndos.set(msg.key, completion);
  return completion;
}

async function runPoll(accounts, deps) {
  const now = deps.now ?? Date.now();
  await pruneMailActions(now);
  const newIds = [];
  const alertJobs = [];
  const invalidatedAuthCodes = [];
  let badge = 0;
  const settled = await Promise.all(
    accounts.map(async (acct) => {
      const key = accountKey(acct);
      const generation = accountGeneration.get(key) ?? 0;
      let candidateMail = [];
      let candidateCodeOnlyKeys = [];
      let establishedBaseline = false;
      const result = await pollAccount(acct, { ...deps, now }).catch(
        (error) => ({ key, error: sanitizeError(error, acct) }),
      );
      await write(async () => {
        if (generation !== (accountGeneration.get(key) ?? 0)) return;
        const before = getInbox();
        const beforeByKey = new Map(before.map((item) => [item.key, item]));
        const old = new Set([...(seenByKey.get(key) ?? []), ...before.map((i) => i.key)]);
        // Existing cache also establishes a baseline when upgrading.
        const baseline =
          baselineByKey.has(key) ||
          before.some((i) => accountKey(i) === key);
        establishedBaseline = baseline;
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
        let inbox = getInbox();
        const fresh = inbox.filter(
          (i) => accountKey(i) === key && !old.has(i.key),
        );
        newIds.push(...fresh.map((i) => i.key));
        const newVersions = inbox.filter((item) => {
          if (accountKey(item) !== key || !old.has(item.key)) return false;
          const previous = beforeByKey.get(item.key);
          // Gmail reuses a thread key and the cache keeps `localRead` sticky.
          // A newer message can still contain a fresh sign-in code, so inspect
          // strictly newer unread thread versions as code-only candidates.
          return previous && Number(item.date) > Number(previous.date);
        });
        const newVersionKeys = new Set(newVersions.map((item) => item.key));
        const updated = inbox.filter((item) => {
          if (accountKey(item) !== key || !old.has(item.key) || item.unread !== true) return false;
          const previous = beforeByKey.get(item.key);
          return newVersionKeys.has(item.key)
            || (!item.localRead && previous && item.snippet !== previous.snippet);
        });
        if (newVersions.length) {
          // A newer Gmail message in the same thread replaces the old code
          // immediately, including when notifications are disabled or the
          // thread was already opened locally.
          const updatedKeys = new Set(newVersions.map((item) => item.key));
          mergeMessages(newVersions.map((item) => ({
            ...item,
            authCodeAvailable: false,
            authCodeExpiresAt: 0,
          })));
          inbox = getInbox();
          invalidatedAuthCodes.push(...updatedKeys);
        }
        await persistCache(inbox);
        await storeAccountEntries([acct], new Map([[key, result]]), now);
        badge = await badgeFor(accounts, deps, inbox);
        const eligible = [
          ...fresh.filter((item) => item.unread && !item.localRead),
          ...updated.filter((item) => !item.localRead),
        ];
        const codeOnly = updated.filter((item) => newVersionKeys.has(item.key) && item.localRead);
        if (baseline) {
          candidateMail = [...eligible, ...codeOnly];
          candidateCodeOnlyKeys = codeOnly.map((item) => item.key);
        }
      });
      if (
        candidateMail.length && establishedBaseline &&
        generation === (accountGeneration.get(key) ?? 0) &&
        !signedOutByKey.has(key) && !deps.manual && acct.notify !== false && !deps.dnd
      ) {
        const settings = await globalThis.chrome?.storage?.local?.get("skipFocusedProvider");
        const focused = settings?.skipFocusedProvider === true
          ? await (deps.focusedProvider ?? focusedProvider)()
          : null;
        if (focused !== acct.provider) {
          alertJobs.push({
            acct,
            key,
            generation,
            items: candidateMail,
            codeOnlyKeys: new Set(candidateCodeOnlyKeys),
          });
        }
      }
      return result;
    }),
  );
  for (const key of invalidatedAuthCodes) {
    // Session invalidation is independent of notification preferences. The
    // cache flag was already cleared in the serialized commit, so copy actions
    // fail safely while these session-only records are removed.
    const ids = await clearAuthCodeRecords([key]);
    for (const id of ids) {
      try { await globalThis.chrome?.notifications?.clear?.(id); } catch { /* optional UI cleanup */ }
    }
  }
  // Process all newly arrived messages newest-first across every account.
  // Only the newest detected code can replace the clipboard in one poll.
  const mailJobs = alertJobs.flatMap((job) => job.items.map((item) => ({ job, item })))
    .sort((a, b) => Number(b.item.date) - Number(a.item.date));
  const autoCopyEnabled = await readAuthCodeAutoCopy().catch(() => false);
  let autoCopyAttempted = false;
  const ordinaryByAccount = new Map();
  const soundAccounts = new Map();
  for (const { job, item } of mailJobs) {
    const isCurrent = () => job.generation === (accountGeneration.get(job.key) ?? 0)
      && !signedOutByKey.has(job.key);
    if (!isCurrent()) continue;
    soundAccounts.set(job.key, job);
    let ordinaryItems = ordinaryByAccount.get(job.key);
    if (!ordinaryItems) {
      ordinaryItems = [];
      ordinaryByAccount.set(job.key, ordinaryItems);
    }
    const result = await runAuthCodePipeline([item], {
      provider: job.acct.provider,
      account: job.acct.account,
      items: [item],
    }, {
      ...deps,
      autoCopyOverride: autoCopyEnabled && !autoCopyAttempted,
      codeOnly: job.codeOnlyKeys?.has(item.key) === true,
      isCurrent,
      notifyMail: async () => {},
    });
    if (result.autoCopyAttempted) autoCopyAttempted = true;
    if (result.ordinary.includes(item.key)) ordinaryItems.push(item);
  }
  for (const [key, items] of ordinaryByAccount) {
    if (!items.length) continue;
    const job = alertJobs.find((entry) => entry.key === key);
    if (!job || job.generation !== (accountGeneration.get(key) ?? 0)
      || signedOutByKey.has(key)) continue;
    const group = { provider: job.acct.provider, account: job.acct.account, items };
    await (deps.notify ?? sendNotification)(group, buildToast(group));
  }
  for (const [key, job] of soundAccounts) {
    if (job.generation !== (accountGeneration.get(key) ?? 0) || signedOutByKey.has(key)) continue;
    try {
      const soundSettings = await (deps.readSoundSettings ?? getSoundSettings)();
      if (!isMuted(soundSettings, [key]))
        await (deps.playSound ?? playChime)(soundSettings.volume);
    } catch {
      /* Sound failure does not undo the cache commit. */
    }
  }
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
    // Sanitized cause identifiers only (see sanitizeError): endpoint code
    // and stable reason, so the next needs-sign-in row can say why without
    // carrying tokens, mail, or free text.
    ...(typeof result?.error?.code === "string" && result.error.code
      ? { code: result.error.code }
      : {}),
    ...(typeof result?.error?.reason === "string" && result.error.reason
      ? { reason: result.error.reason }
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

function authCodeNotificationId() {
  return `${AUTH_CODE_NOTIFICATION_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function authCodeSenderContext(item) {
  const sender = String(item?.from ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\b[a-z0-9]{4,10}\b/gi, (token) => /\d/.test(token) ? "" : token)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return sender ? `From ${sender}` : `${item.provider} mailbox`;
}

async function createAuthCodeNotification(item, { copied, expiresAt, isCurrent = () => true }) {
  const notifications = globalThis.chrome?.notifications;
  if (!notifications?.create || !isCurrent()) return;
  const id = authCodeNotificationId();
  const title = `${item.account} (${item.provider === "demo" ? "local demo" : item.provider})`;
  const details = {
    type: "basic",
    silent: true,
    iconUrl: notificationIconUrl(),
    title,
    message: copied
      ? "Your sign-in code is ready to paste."
      : "A sign-in code is ready. Choose Copy code to copy it.",
    contextMessage: authCodeSenderContext(item),
    buttons: [{ title: copied ? "Copy again" : "Copy code" }],
  };
  try {
    await mapNotificationToMessage(id, item.key, expiresAt);
    if (!isCurrent()) {
      await removeNotificationMapping(id);
      return;
    }
    await notifications.create(id, details);
    if (!isCurrent()) {
      await notifications.clear?.(id);
      await removeNotificationMapping(id);
    }
  } catch {
    await removeNotificationMapping(id).catch(() => {});
    // A popup card still exposes Copy code if the platform omits this toast.
  }
}

async function updateAuthCodeNotification(id, copied) {
  try {
    await globalThis.chrome?.notifications?.update?.(id, {
      message: copied
        ? "Your sign-in code is ready to paste."
        : "Could not copy the sign-in code. Try again from the inbox.",
      buttons: copied ? [{ title: "Copy again" }] : [{ title: "Try again" }],
    });
  } catch {
    /* The inbox still shows the current copy action. */
  }
}

async function setAuthCodeAvailable(item, expiresAt, available = true) {
  if (item.provider === "demo") {
    const demos = await getDemoInbox();
    const next = demos.map((entry) => entry.key === item.key
      ? available
        ? { ...entry, authCodeAvailable: true, authCodeExpiresAt: expiresAt }
        : { ...entry, authCodeAvailable: false, authCodeExpiresAt: 0 }
      : entry);
    await globalThis.chrome?.storage?.local?.set({ [AUTH_CODE_DEMO_INBOX_KEY]: next });
    return;
  }
  await write(async () => {
    const current = getInbox().find((entry) => entry.key === item.key);
    if (!current) return;
    mergeMessages([available
      ? { ...current, authCodeAvailable: true, authCodeExpiresAt: expiresAt }
      : { ...current, authCodeAvailable: false, authCodeExpiresAt: 0 }]);
    await persistCache(getInbox());
  });
}

async function runAuthCodePipeline(items, group, deps = {}) {
  if (!items?.length) return { detected: [], ordinary: [] };
  const isCurrent = deps.isCurrent ?? (() => true);
  const autoCopy = typeof deps.autoCopyOverride === "boolean"
    ? deps.autoCopyOverride
    : await readAuthCodeAutoCopy().catch(() => false);
  return processFreshMail(items, {
    now: deps.now,
    autoCopy,
    codeOnly: deps.codeOnly === true,
    saveCode: async (key, code, expiresAt, now, version) => {
      if (!isCurrent()) return false;
      const saved = await savePendingAuthCode(key, code, expiresAt, now, version);
      if (!isCurrent()) {
        await clearAuthCodeRecords([key]);
        return false;
      }
      return saved;
    },
    onCodeAvailable: async (key, _available) => {
      if (!isCurrent()) return;
      const item = items.find((entry) => entry.key === key);
      if (item) {
        // The notification metadata is non-secret; the actual code remains
        // in storage.session only.
        const record = await getPendingAuthCode(key);
        if (!isCurrent()) return;
        await setAuthCodeAvailable(item, record?.expiresAt ?? Date.now());
      }
    },
    copyCode: async (code) => isCurrent() && copyAuthCodeToClipboard(code, { isCurrent }),
    notifyCode: (item, result) => createAuthCodeNotification(item, { ...result, isCurrent }),
    notifyMail: async (ordinary) => {
      if (!ordinary.length) return;
      if (deps.notifyMail) return deps.notifyMail(ordinary);
      const noticeGroup = { provider: group.provider, account: group.account, items: ordinary };
      await (deps.notify ?? sendNotification)(noticeGroup, buildToast(noticeGroup));
    },
    fetchBody: async (item) => {
      if (item.provider === "demo") {
        const demo = await getDemoMessage(item.key);
        return demo ? { ok: true, content: demo.demoBody, contentType: "text" } : { ok: false };
      }
      return handleMessageBody({ key: item.key }, deps);
    },
  });
}

export async function handleCopyAuthCode(key, deps = {}) {
  await ready;
  let item = getInbox().find((entry) => entry.key === key);
  if (!item) item = await getDemoMessage(key);
  if (!item) return { ok: false, code: "message-unavailable" };
  if (item.authCodeAvailable !== true || Number(item.authCodeExpiresAt) <= (deps.now ?? Date.now()))
    return { ok: false, code: "code-unavailable" };
  const expectedVersion = String(Number(item.date) || 0);
  const demoVersion = demoGeneration;
  let isCurrent = () => true;
  if (item.provider !== "demo") {
    const accounts = await loadAccounts();
    const acct = accounts.find((entry) => accountKey(entry) === accountKey(item));
    if (!acct || !isEnabled(acct) || signedOutByKey.has(accountKey(acct)))
      return { ok: false, code: "account-unavailable" };
    const generation = accountGeneration.get(accountKey(acct)) ?? 0;
    isCurrent = () => {
      const latest = getInbox().find((entry) => entry.key === key);
      return generation === (accountGeneration.get(accountKey(acct)) ?? 0)
        && !signedOutByKey.has(accountKey(acct))
        && latest?.authCodeAvailable === true
        && Number(latest.authCodeExpiresAt) > (deps.now ?? Date.now())
        && String(Number(latest.date) || 0) === expectedVersion;
    };
  } else {
    isCurrent = () => demoVersion === demoGeneration;
  }
  const record = await getPendingAuthCode(key, deps.now ?? Date.now());
  if (!isCurrent()) return { ok: false, code: "account-unavailable" };
  if (!record) {
    await setAuthCodeAvailable(item, 0, false).catch(() => {});
    return { ok: false, code: "code-expired" };
  }
  const latest = item.provider === "demo"
    ? await getDemoMessage(key)
    : getInbox().find((entry) => entry.key === key);
  if (!latest || latest.authCodeAvailable !== true
    || Number(latest.authCodeExpiresAt) <= (deps.now ?? Date.now())
    || String(Number(latest.date) || 0) !== expectedVersion
    || String(record.version) !== expectedVersion || !isCurrent())
    return { ok: false, code: "code-unavailable" };
  const copied = deps.copyCode
    ? await deps.copyCode(record.code)
    : await copyAuthCodeToClipboard(record.code, { isCurrent });
  return copied
    ? { ok: true }
    : { ok: false, code: "clipboard-unavailable" };
}

export async function handleAuthCodeNotificationButton(notificationId, buttonIndex) {
  if (buttonIndex !== 0 || !notificationId?.startsWith(AUTH_CODE_NOTIFICATION_PREFIX)) return;
  const key = await messageForNotification(notificationId);
  if (!key) {
    await updateAuthCodeNotification(notificationId, false);
    return;
  }
  const result = await handleCopyAuthCode(key);
  await updateAuthCodeNotification(notificationId, result.ok);
  if (result.ok) await showAuthCodeCopyConfirmation(key);
}

async function showAuthCodeCopyConfirmation(key) {
  const item = getInbox().find((entry) => entry.key === key) ?? await getDemoMessage(key);
  if (!item) return;
  try {
    await globalThis.chrome?.notifications?.create?.(authCodeNotificationId(), {
      type: "basic",
      silent: true,
      iconUrl: notificationIconUrl(),
      title: `${item.account} (${item.provider === "demo" ? "local demo" : item.provider})`,
      message: "Your sign-in code is ready to paste.",
      contextMessage: authCodeSenderContext(item),
    });
  } catch {
    /* Clipboard success still stands if native notifications are unavailable. */
  }
}

export async function handleAuthCodeNotificationClick(notificationId) {
  if (!notificationId?.startsWith(AUTH_CODE_NOTIFICATION_PREFIX)) return;
  const key = await messageForNotification(notificationId);
  if (!key) return;
  const result = await handleCopyAuthCode(key);
  await updateAuthCodeNotification(notificationId, result.ok);
  if (result.ok) await showAuthCodeCopyConfirmation(key);
}

async function clearAuthCodesForAccount(acct) {
  const items = getInbox().filter((item) => accountKey(item) === accountKey(acct));
  const ids = await clearAuthCodeRecords(items.map((item) => item.key));
  await write(async () => {
    for (const item of items)
      mergeMessages([{ ...item, authCodeAvailable: false, authCodeExpiresAt: 0 }]);
    await persistCache(getInbox());
  });
  for (const id of ids) {
    try { await globalThis.chrome?.notifications?.clear?.(id); } catch { /* optional UI cleanup */ }
  }
}

async function processDemoArrival(items) {
  if (!items.length) return;
  // The shared helper reads the same setting and routes body lookup through
  // the local demo store.
  await runAuthCodePipeline(items, {
    provider: "demo",
    account: "Local auth code demo",
  });
}

export function handleDemoGenerate(scenario = "numeric", deps = {}) {
  return serializeDemo(async () => {
  await ready;
  if (!AUTH_CODE_DEMO_SCENARIOS.includes(scenario)) return { ok: false, code: "invalid-scenario" };
  const item = createDemoEmail(scenario, deps);
  await addDemoEmails([item]);
  await processDemoArrival([item]);
  return { ok: true, key: item.key };
  });
}

async function runDemoSequenceTickUnlocked() {
  const store = globalThis.chrome?.storage?.local;
  const data = await store?.get(AUTH_CODE_DEMO_SEQUENCE_KEY);
  const sequence = data?.[AUTH_CODE_DEMO_SEQUENCE_KEY];
  if (!sequence || !Array.isArray(sequence.scenarios) || sequence.index >= sequence.scenarios.length) {
    await globalThis.chrome?.alarms?.clear?.(AUTH_CODE_DEMO_ALARM);
    await store?.remove?.(AUTH_CODE_DEMO_SEQUENCE_KEY);
    return;
  }
  const scenario = sequence.scenarios[sequence.index];
  const item = createDemoEmail(scenario);
  await addDemoEmails([item]);
  await processDemoArrival([item]);
  const next = { ...sequence, index: sequence.index + 1 };
  if (next.index >= next.scenarios.length) {
    await globalThis.chrome?.alarms?.clear?.(AUTH_CODE_DEMO_ALARM);
    await store?.remove?.(AUTH_CODE_DEMO_SEQUENCE_KEY);
  } else {
    await store?.set?.({ [AUTH_CODE_DEMO_SEQUENCE_KEY]: next });
    await globalThis.chrome?.alarms?.create?.(AUTH_CODE_DEMO_ALARM, {
      delayInMinutes: DEMO_SEQUENCE_INTERVAL_SECONDS / 60,
    });
  }
}

export function handleDemoSequence(scenarios = AUTH_CODE_DEMO_SCENARIOS) {
  return serializeDemo(async () => {
  await ready;
  const safe = Array.isArray(scenarios)
    ? scenarios.filter((scenario) => AUTH_CODE_DEMO_SCENARIOS.includes(scenario)).slice(0, 20)
    : [];
  if (!safe.length) return { ok: false, code: "invalid-sequence" };
  await globalThis.chrome?.storage?.local?.set({
    [AUTH_CODE_DEMO_SEQUENCE_KEY]: { scenarios: safe, index: 0 },
  });
  await runDemoSequenceTickUnlocked();
  return { ok: true, remaining: Math.max(0, safe.length - 1) };
  });
}

export function handleDemoSequenceTick() {
  return serializeDemo(runDemoSequenceTickUnlocked);
}

export function handleDemoClear() {
  return serializeDemo(async () => {
  await ready;
  demoGeneration++;
  const items = await clearDemoInbox();
  const ids = await clearAuthCodeRecords(items.map((item) => item.key));
  for (const id of ids) {
    try { await globalThis.chrome?.notifications?.clear?.(id); } catch { /* optional UI cleanup */ }
  }
  await globalThis.chrome?.alarms?.clear?.(AUTH_CODE_DEMO_ALARM);
  await globalThis.chrome?.storage?.local?.remove?.(AUTH_CODE_DEMO_SEQUENCE_KEY);
  return { ok: true, cleared: items.length };
  });
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
  const stored = await chrome.storage.local.get("pollIntervalMs");
  const periodInMinutes = normalizePollInterval(stored?.pollIntervalMs) / 60000;
  const existing = await alarms.get?.(ALARM_NAME);
  if (existing?.periodInMinutes === periodInMinutes) return;
  await alarms.create(ALARM_NAME, { delayInMinutes: periodInMinutes, periodInMinutes });
}

async function ensureDemoSequenceAlarm() {
  const alarms = globalThis.chrome?.alarms;
  const store = globalThis.chrome?.storage?.local;
  if (!alarms?.create || !store?.get) return;
  const data = await store.get(AUTH_CODE_DEMO_SEQUENCE_KEY);
  const sequence = data?.[AUTH_CODE_DEMO_SEQUENCE_KEY];
  if (!sequence || !Array.isArray(sequence.scenarios) || sequence.index >= sequence.scenarios.length)
    return;
  if (await alarms.get?.(AUTH_CODE_DEMO_ALARM)) return;
  try {
    await alarms.create(AUTH_CODE_DEMO_ALARM, { delayInMinutes: DEMO_SEQUENCE_INTERVAL_SECONDS / 60 });
  } catch {
    try { await alarms.create(AUTH_CODE_DEMO_ALARM, { delayInMinutes: 1 }); }
    catch { /* The sequence remains saved for a later worker startup. */ }
  }
}

// Preference saves have their own queue: a slow mailbox poll must not block
// scheduling, and overlapping settings transactions must not undo each other.
let settingsTail = Promise.resolve();
function savePollInterval(pollIntervalMs) {
  if (!validPollInterval(pollIntervalMs)) return Promise.resolve({ ok: false, code: "invalid-interval" });
  const operation = settingsTail.then(async () => {
    const store = globalThis.chrome?.storage?.local;
    const alarms = globalThis.chrome?.alarms;
    let previous, alarm, snapshot = false;
    try {
      previous = await store.get("pollIntervalMs");
      alarm = await alarms.get(ALARM_NAME);
      snapshot = true;
      await store.set({ pollIntervalMs });
      const periodInMinutes = pollIntervalMs / 60000;
      await alarms.create(ALARM_NAME, { delayInMinutes: periodInMinutes, periodInMinutes });
      return { ok: true, pollIntervalMs };
    } catch {
      let uncertain = false;
      if (snapshot) {
        // Attempt both repairs even if one fails. Never report a failed Save
        // as applied, since storage and alarms are not an atomic transaction.
        try {
          if (previous.pollIntervalMs === undefined) await store.remove("pollIntervalMs");
          else await store.set({ pollIntervalMs: previous.pollIntervalMs });
        } catch { uncertain = true; }
        try {
          if (alarm) await alarms.create(ALARM_NAME, { when: alarm.scheduledTime, ...(alarm.periodInMinutes === undefined ? {} : {periodInMinutes:alarm.periodInMinutes}) });
          else await alarms.clear(ALARM_NAME);
        } catch { uncertain = true; }
      }
      return { ok: false, code: "save-failed", ...(uncertain ? { uncertain: true } : {}) };
    }
  });
  settingsTail = operation.catch(() => {});
  return operation;
}

// One initialization promise created at worker evaluation. Every polling
// entry point awaits it, so an alarm or message that wakes a terminated
// worker hydrates memory from storage before polling — never polling with
// an empty cache, never persisting an empty inbox over stored mail.
async function init() {
  await hydrateCache();
  await hydrateAccountState();
  await pruneMailActions();
  try { await ensureAlarm(); } catch { /* Later initialization or Save can repair scheduling; mail stays usable. */ }
  try { await ensureDemoSequenceAlarm(); } catch { /* A later startup can resume a saved debug sequence. */ }
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
  const current = () => generation === (accountGeneration.get(key) ?? 0);
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
    if (!current()) return { key, needsSignIn: true };
    if (isRateOrServer(err?.status)) {
      return write(async () => {
        if (!current()) return { key, needsSignIn: true };
        const result = {
          key,
          backedOff: true,
          ...recordBackoff(acct, deps.now ?? Date.now()),
          error: sanitizeError(err, acct),
        };
        await storeAccountEntries([acct], new Map([[key, result]]));
        return result;
      });
    }
    if (isOfflineNow()) {
      return write(async () => {
        if (!current()) return { key, needsSignIn: true };
        markOffline(acct);
        const offlineResult = {
          key,
          offline: true,
          error: sanitizeError(err, acct),
        };
        await storeAccountEntries([acct], new Map([[key, offlineResult]]));
        return offlineResult;
      });
    }
    if (err?.transient) {
      return write(async () => {
        if (!current()) return { key, needsSignIn: true };
        const transientResult = { key, error: sanitizeError(err, acct) };
        await storeAccountEntries([acct], new Map([[key, transientResult]]));
        return transientResult;
      });
    }
    // Short diagnostic code for the popup: the sanitized error keeps
    // status only, which leaves pre-popup failures (no status) mute.
    // Codes are fixed identifiers — never addresses, mail, or text.
    const failure = {
      key,
      needsSignIn: true,
      code: signInCode(err),
      error: sanitizeError(err, acct),
    };
    return write(async () => {
      if (!current()) return { key, needsSignIn: true };
      markNeedsSignIn(acct);
      await storeAccountEntries([acct], new Map([[key, failure]]));
      return failure;
    });
  }
  if (!current()) return { key, needsSignIn: true };
  signedOutByKey.delete(key);
  clearBackoff(acct);
  clearNeedsSignIn(acct);
  clearOffline(acct);
  const wasPaused = !isEnabled(acct);
  const pollAcct = wasPaused ? { ...acct, enabled: true } : acct;
  const pollList = list.map((account) =>
    accountKey(account) === key ? pollAcct : account,
  );
  if (!pollList.some((account) => accountKey(account) === key))
    pollList.push(pollAcct);
  const real = buildTokenProvider(list);
  // Serialize the recovery poll against alarm cycles on the shared poll
  // chain. A sign-in fetch starts only after earlier cycles committed, so
  // its complete reconcile can never wipe newer alarm mail (issue #2).
  const run = pollTail.then(() =>
    signInPoll(pollList, pollAcct, key, generation, real, pollDeps, wasPaused),
  );
  pollTail = run.catch(() => {});
  return run;
}

async function signInPoll(list, acct, key, generation, real, pollDeps, wasPaused) {
  const current = () => generation === (accountGeneration.get(key) ?? 0);
  if (!current()) return { key, needsSignIn: true };
  const now = pollDeps.now ?? Date.now();
  const getToken = pollDeps.getToken ?? real.getToken;
  const refreshToken = pollDeps.refreshToken ?? real.refreshToken;
  const providerFetcher = pollDeps.fetchers?.[acct.provider] ?? fetchers[acct.provider];
  const result = await pollAccount(acct, {
    ...pollDeps,
    getToken: async (account) => {
      if (!current()) throw new Error("recovery superseded");
      const token = await getToken(account);
      if (!current()) throw new Error("recovery superseded");
      return token;
    },
    refreshToken: async (account, rejectedToken) => {
      if (!current()) throw new Error("recovery superseded");
      const token = await refreshToken(account, rejectedToken);
      if (!current()) throw new Error("recovery superseded");
      return token;
    },
    ...(providerFetcher
      ? {
          fetchers: {
            ...pollDeps.fetchers,
            [acct.provider]: async (...args) => {
              if (!current()) throw new Error("recovery superseded");
              return providerFetcher(...args);
            },
          },
        }
      : {}),
  }).catch((error) => ({ key, error: sanitizeError(error, acct) }));
  if (!current()) return { key, needsSignIn: true };
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
    if (!current()) return;
    let commitAcct = acct;
    let commitList = list;
    if (wasPaused) {
      const fresh = await loadAccounts();
      if (!current()) return;
      const storedAcct = fresh.find((account) => accountKey(account) === key);
      if (!storedAcct) return;
      commitAcct = storedAcct;
      commitList = fresh;
      const succeeded = Array.isArray(result?.items) && !result.error &&
        !result.needsSignIn && !result.offline && !result.skipped &&
        !result.backedOff;
      if (succeeded) {
        commitAcct = { ...storedAcct, enabled: true };
        commitList = fresh.map((account) =>
          accountKey(account) === key ? commitAcct : account,
        );
        if (!current()) return;
        await saveAccounts(commitList);
        if (!current()) return;
      }
    }
    if (result.items !== undefined) {
      reconcileAccount(commitAcct, result.items, result.items.complete !== false);
      baselineByKey.add(key);
      seenByKey.set(key, result.items.map((i) => i.key).slice(0, 200));
      await persistCache(getInbox());
    }
    if (!current()) return;
    await storeAccountEntries([commitAcct], new Map([[key, result]]), now);
    if (!current()) return;
    await badgeFor(commitList, pollDeps);
  });
  return current() ? result : { key, needsSignIn: true };
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

export async function handleMessageBody(msg, deps = {}) {
  await ready;
  if (String(msg.key ?? "").startsWith("demo:")) {
    const demo = await getDemoMessage(msg.key);
    return demo
      ? { ok: true, content: demo.demoBody, contentType: "text" }
      : { ok: false, code: "message-unavailable" };
  }
  const accounts = await loadAccounts();
  const item = getInbox().find(item => item.key === msg.key);
  const acct = accounts.find(acct => item && accountKey(acct) === accountKey(item));
  if (!acct || !isEnabled(acct) || signedOutByKey.has(accountKey(acct)))
    return { ok: false, code: "sign-in" };
  const generation = accountGeneration.get(accountKey(acct)) ?? 0;
  const current = () => generation === (accountGeneration.get(accountKey(acct)) ?? 0);
  const id = messageIdOf(item.key);
  try {
    let body;
    if (deps.readBody) body = await deps.readBody(acct, id);
    else if (acct.provider === "gmail") {
      const session = await gmailSession(acct.account);
      if (!current()) return { ok: false, code: "sign-in" };
      body = await readGmailMessageBody(acct.account, session, id);
    } else {
      const tokens = buildTokenProvider(accounts);
      let token = await tokens.getToken(acct);
      if (!current()) return { ok: false, code: "sign-in" };
      try { body = await fetchOutlookMessageBody(token, id); }
      catch (error) {
        if (error.status !== 401 || !current()) throw error;
        token = await tokens.refreshToken(acct, token);
        if (!current()) return { ok: false, code: "sign-in" };
        body = await fetchOutlookMessageBody(token, id);
      }
    }
    if (!current()) return { ok: false, code: "sign-in" };
    if (!body || body.recognized === false || typeof body.content !== "string"
      || !["text", "html"].includes(body.contentType)) return { ok: false, code: "unavailable" };
    return { ok: true, content: body.content, contentType: body.contentType };
  } catch {
    return { ok: false, code: "unavailable" };
  }
}

export async function handleMessage(msg, deps = {}) {
  await ready;
  if (msg.type === "message-body") return handleMessageBody(msg, deps);
  if (msg.type === "copy-auth-code") return handleCopyAuthCode(msg.key, deps);
  if (msg.type === "demo-generate") return handleDemoGenerate(msg.scenario, deps);
  if (msg.type === "demo-sequence") return handleDemoSequence(msg.scenarios);
  if (msg.type === "demo-clear") return handleDemoClear();
  if (msg.type === "set-auth-code-auto-copy") {
    const enabled = msg.enabled === true;
    await globalThis.chrome?.storage?.local?.set({ [AUTH_CODE_AUTO_COPY_KEY]: enabled });
    return { ok: true, enabled };
  }
  if (msg.type === "set-poll-interval") return savePollInterval(msg.pollIntervalMs);
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
  if (msg.type === "mail-action") return handleMailboxAction(msg, deps);
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
  await clearAuthCodesForAccount(acct);
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
      const journal = await mailJournal();
      for (const [id, record] of Object.entries(journal)) if (accountKey(record.item) === key) delete journal[id];
      await saveJournal(journal);
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
    else if (alarm?.name === AUTH_CODE_DEMO_ALARM)
      void handleDemoSequenceTick();
  });
  chrome.notifications?.onButtonClicked?.addListener((id, buttonIndex) => {
    void handleAuthCodeNotificationButton(id, buttonIndex);
  });
  chrome.notifications?.onClicked?.addListener((id) => {
    void handleAuthCodeNotificationClick(id);
  });
  chrome.runtime?.onMessage?.addListener((msg, _sender, sendResponse) => {
    if (
      ![
        "message-body",
        "copy-auth-code",
        "demo-generate",
        "demo-sequence",
        "demo-clear",
        "set-auth-code-auto-copy",
        "set-poll-interval",
        "refresh",
        "mark-read",
        "mail-action",
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
