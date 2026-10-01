// Worker-only mailbox mutations. Never expose provider bodies or session secrets.
import { parseFeed } from './gmail.js';
import { recordMailActionDiagnostic } from './mail-action-diagnostics.js';

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
export async function gmailSession(account) {
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
    // Recheck ownership after collecting session values, before any write.
    const check = await request(base + 'feed/atom', { credentials: 'include', cache: 'no-store' });
    if (parseFeed(await check.text(), slot).account !== account.toLowerCase()) throw new MailActionError('sign-in');
    // Session GETs can update cookies. Take the action token last so the POST
    // does not pair a fresh session cookie with a token captured beforehand.
    const cookie = await globalThis.chrome?.cookies?.get({ name: 'GMAIL_AT', url: base });
    if (!cookie?.value) throw new MailActionError('sign-in');
    return { base, csrf: cookie.value, key };
  }
  throw new MailActionError('sign-in');
}

export async function mutateGmailConversation(account, id, action, assertAuthorized = () => {}) {
  if (!/^[a-f0-9]+$/i.test(id) || !['read', 'trash', 'undo'].includes(action)) throw new MailActionError('invalid-action');
  const { base, csrf, key } = await gmailSession(account);
  // Fixed fields only: no account address, message ID, URL, body or session key.
  const diagnostic = { event: 'gmail-mail-action', entryPoint: 'popup-mail-action', requestId: crypto.randomUUID(), action, slot: Number(/\/u\/(\d+)\//.exec(base)[1]) };
  const report = async (outcome, status, response, unreadInboxAbsent = false) => {
    const event = { ...diagnostic, outcome, status, response, unreadInboxAbsent, at: Date.now() };
    try { console.info(JSON.stringify(event)); } catch { /* Diagnostics must not change a write's outcome. */ }
    await recordMailActionDiagnostic(event);
  };
  let url;
  const body = new FormData();
  if (action === 'undo') {
    // Session-mode recovery returns the conversation to Inbox. Gmail can
    // retire this endpoint; a refused/ambiguous response never reports success.
    url = base + 'h/?s=t';
    body.set('at', csrf);
    body.set('t', id);
    body.set('tact', '');
    body.set('nvp_a_ib', 'Move to Inbox');
  } else {
    url = base + 's/?' + new URLSearchParams({ v: 'or', ik: key, at: csrf, subui: 'chrome', hl: 'en' });
    body.set('s_jr', JSON.stringify([null, [[null, null, null, [null, action === 'read' ? 3 : 9, id, id, 'l:all', [], [], []]], [null, null, null, null, null, null, [null, true, false]], [null, null, null, null, null, null, [null, true, false]]], 2, null, null, null, key]));
  }
  assertAuthorized();
  let response;
  try { response = await request(url, { method: 'POST', credentials: 'include', body }, true); }
  catch (error) {
    await report(error.uncertain ? 'uncertain' : 'rejected', error.status, 'request-failed');
    throw error;
  }
  let text;
  try { text = await response.text(); } catch {
    await report('uncertain', response.status, 'unreadable');
    throw new MailActionError('check-mailbox', undefined, true);
  }
  if (!/\[\s*"ar"\s*,\s*1\s*,/.test(text)) {
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
  await report('acknowledged', response.status, 'acknowledged');
  return { id };
}
