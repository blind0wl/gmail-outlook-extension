// Worker-only mailbox mutations. Never expose provider bodies or session secrets.
import { parseFeed } from './gmail.js';
import { recordMailActionDiagnostic } from './mail-action-diagnostics.js';
import { parseGmailUndoAppInfo, buildGmailUndoRequest } from './gmail-undo.js';
import { readGmailConversationMembers, verifyGmailConversationState } from './gmail-conversation-state.js';

export class MailActionError extends Error {
  constructor(code, status, uncertain = false) {
    super('Mailbox action failed');
    this.code = code;
    this.status = status;
    this.uncertain = uncertain;
  }
}

async function request(url, options = {}, write = false) {
  let response;
  try {
    response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  } catch {
    throw new MailActionError(write ? 'check-mailbox' : 'unavailable', undefined, write);
  }
  if (!response.ok) {
    throw new MailActionError(response.status === 401 || response.status === 403 ? 'sign-in' : 'provider-error', response.status, write && response.status >= 500);
  }
  return response;
}

export async function inspectOutlookMessage(token, id) {
  const response = await request(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}?$select=id,isRead,parentFolderId`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  try { return await response.json(); } catch { throw new MailActionError('unavailable'); }
}

export async function mutateOutlookMessage(token, id, action, folder = 'inbox', assertAuthorized = () => {}) {
  if (!['read', 'trash', 'undo'].includes(action) || !id) throw new MailActionError('invalid-action');
  assertAuthorized();
  const response = await request(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}${action === 'read' ? '' : '/move'}`, {
    method: action === 'read' ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(action === 'read' ? { isRead: true } : { destinationId: action === 'trash' ? 'deleteditems' : folder }),
  }, true);
  try {
    const result = await response.json();
    if (!result?.id) throw Error();
    return result;
  } catch { throw new MailActionError('check-mailbox', undefined, true); }
}

// Gmail's private session protocol is deliberately isolated. Resolve slots
// afresh on every operation; never use a cached slot across browser sign-ins.
export async function gmailSession(account, forUndo = false) {
  for (let slot = 0; slot < 10; slot++) {
    let feed;
    try {
      const response = await request(`https://mail.google.com/mail/u/${slot}/feed/atom`, { credentials: 'include', cache: 'no-store' });
      feed = parseFeed(await response.text(), slot);
    } catch (error) {
      if (error.status === 404) break;
      continue;
    }
    if (feed.account !== account.toLowerCase()) continue;
    const base = `https://mail.google.com/mail/u/${slot}/`;
    const response = await request(base, { credentials: 'include', cache: 'no-store' });
    const html = await response.text();
    const key = /(?:GM_ID_KEY|ID_KEY)\s*=\s*["']([^"']+)["']/.exec(html)?.[1];
    if (!key) throw new MailActionError('gmail-changed');
    const appInfo = forUndo ? parseGmailUndoAppInfo(html, key) : null;
    if (forUndo && !appInfo) throw new MailActionError('gmail-changed');
    // Recheck ownership after collecting session values, before any write.
    const check = await request(base + 'feed/atom', { credentials: 'include', cache: 'no-store' });
    if (parseFeed(await check.text(), slot).account !== account.toLowerCase()) throw new MailActionError('sign-in');
    // Session GETs can update cookies. Take the action token last so the POST
    // does not pair a fresh session cookie with a token captured beforehand.
    const cookie = await globalThis.chrome?.cookies?.get({ name: 'GMAIL_AT', url: base });
    if (!cookie?.value) throw new MailActionError('sign-in');
    return { base, csrf: cookie.value, key, ...(forUndo ? { appInfo } : {}) };
  }
  throw new MailActionError('sign-in');
}

export async function mutateGmailConversation(account, id, action, assertAuthorized = () => {}) {
  if (!/^[a-f0-9]+$/i.test(id) || !['read', 'trash', 'undo'].includes(action)) throw new MailActionError('invalid-action');
  const session = await gmailSession(account, action === 'undo');
  const { base, csrf, key } = session;
  // Fixed fields only: no account address, message ID, URL, body or session key.
  const diagnostic = { event: 'gmail-mail-action', entryPoint: 'popup-mail-action', requestId: crypto.randomUUID(), action, slot: Number(/\/u\/(\d+)\//.exec(base)[1]) };
  const report = async (outcome, status, response, unreadInboxAbsent = false) => {
    const event = { ...diagnostic, outcome, status, response, unreadInboxAbsent, at: Date.now() };
    try { console.info(JSON.stringify(event)); } catch { /* Diagnostics must not change a write's outcome. */ }
    await recordMailActionDiagnostic(event);
  };
  const confirmState = async status => {
    assertAuthorized();
    if (!await verifyGmailConversationState(account, session, id, action)) return null;
    assertAuthorized();
    await report('acknowledged', status, 'state-verified');
    return { id };
  };
  let url, options;
  const body = new FormData();
  if (action === 'undo') {
    assertAuthorized();
    const state = await readGmailConversationMembers(account, session, id);
    assertAuthorized();
    if (!state) throw new MailActionError('gmail-changed');
    if (state.allInbox) {
      await report('acknowledged', undefined, 'state-verified');
      return { id };
    }
    if (!state.allTrash) throw new MailActionError('check-mailbox');
    const slot = Number(/\/u\/(\d+)\//.exec(base)[1]);
    const bootstrap = await request(`https://mail.google.com/sync/u/${slot}/token?hl=en&c=0&rt=r&pt=ji`, {
      method: 'POST', credentials: 'include', cache: 'no-store', body: '',
      headers: { 'Content-Type': 'application/json', 'X-Same-Domain': '1' },
    });
    let token;
    try { token = await bootstrap.text(); } catch { throw new MailActionError('unavailable'); }
    if (!/^[A-Za-z0-9:_-]{20,2048}$/.test(token)) throw new MailActionError('gmail-changed');
    // Token bootstrap is not a mailbox write. Recheck ownership after it and
    // authorization immediately before the single scoped mutation below.
    const ownership = await request(base + 'feed/atom', { credentials: 'include', cache: 'no-store' });
    if (parseFeed(await ownership.text(), slot).account !== account.toLowerCase()) throw new MailActionError('sign-in');
    ({ url, options } = buildGmailUndoRequest(base, id, state.memberIds, token, session.appInfo));
  } else {
    url = base + 's/?' + new URLSearchParams({ v: 'or', ik: key, at: csrf, subui: 'chrome', hl: 'en' });
    body.set('s_jr', JSON.stringify([null, [[null, null, null, [null, action === 'read' ? 3 : 9, id, id, 'l:all', [], [], []]], [null, null, null, null, null, null, [null, true, false]], [null, null, null, null, null, null, [null, true, false]]], 2, null, null, null, key]));
  }
  options ||= { method: 'POST', credentials: 'include', body };
  assertAuthorized();
  let response;
  try { response = await request(url, options, true); }
  catch (error) {
    if (error.uncertain) {
      const confirmed = await confirmState(error.status);
      if (confirmed) return confirmed;
    }
    await report(error.uncertain ? 'uncertain' : 'rejected', error.status, 'request-failed');
    throw error;
  }
  let text;
  try { text = await response.text(); } catch {
    const confirmed = await confirmState(response.status);
    if (confirmed) return confirmed;
    await report('uncertain', response.status, 'unreadable');
    throw new MailActionError('check-mailbox', undefined, true);
  }
  // The current private endpoint can finish a successful action without the
  // legacy ar record. Prove the exact postcondition; never infer it from an
  // HTTP status, a bounded search or absence in the unread feed.
  const confirmed = await confirmState(response.status);
  if (confirmed) return confirmed;
  const error = new MailActionError('check-mailbox', undefined, true);
  error.unreadInboxAbsent = false;
  if (action !== 'undo') {
    try {
      const response = await request(base + 'feed/atom', { credentials: 'include', cache: 'no-store' });
      const xml = await response.text();
      const feed = parseFeed(xml, Number(/\/u\/(\d+)\//.exec(base)[1]));
      // Feed absence establishes inbox state, not which mutation succeeded.
      // A truncated feed cannot prove absence; retain the uncertainty lock.
      error.unreadInboxAbsent = feed.account === account.toLowerCase()
        && /<fullcount>\d+<\/fullcount>/i.test(xml)
        && feed.fullcount === feed.entries.length
        && !feed.entries.some(entry => entry.id.toLowerCase() === id.toLowerCase());
    } catch { /* Reconciliation failure must never replay the POST. */ }
  }
  const challenge = text.length < 200 && /https:\/\/mail\.google\.com\/mail\/u\/\d+\/spreauth\b/.test(text);
  await report('uncertain', response.status, challenge ? 'sign-in-challenge' : 'unrecognized', error.unreadInboxAbsent);
  throw error;
}
