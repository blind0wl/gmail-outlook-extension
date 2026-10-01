// Worker-only mailbox mutations. Never expose provider bodies or session secrets.
import { parseFeed } from './gmail.js';

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
      const response = await request(`https://mail.google.com/mail/u/${slot}/feed/atom`, { credentials: 'include' });
      feed = parseFeed(await response.text(), slot);
    } catch (error) {
      if (error.status === 404) break;
      continue;
    }
    if (feed.account !== account.toLowerCase()) continue;
    const base = `https://mail.google.com/mail/u/${slot}/`;
    const cookie = await globalThis.chrome?.cookies?.get({ name: 'GMAIL_AT', url: base });
    if (!cookie?.value) throw new MailActionError('sign-in');
    const response = await request(base, { credentials: 'include' });
    const html = await response.text();
    const key = /(?:GM_ID_KEY|ID_KEY)\s*=\s*["']([^"']+)["']/.exec(html)?.[1];
    if (!key) throw new MailActionError('gmail-changed');
    // Recheck ownership after collecting session values, before any write.
    const check = await request(base + 'feed/atom', { credentials: 'include' });
    if (parseFeed(await check.text(), slot).account !== account.toLowerCase()) throw new MailActionError('sign-in');
    return { base, csrf: cookie.value, key };
  }
  throw new MailActionError('sign-in');
}

export async function mutateGmailConversation(account, id, action, assertAuthorized = () => {}) {
  if (!/^[a-f0-9]+$/i.test(id) || !['read', 'trash', 'undo'].includes(action)) throw new MailActionError('invalid-action');
  const { base, csrf, key } = await gmailSession(account);
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
  const response = await request(url, { method: 'POST', credentials: 'include', body }, true);
  let text;
  try { text = await response.text(); } catch { throw new MailActionError('check-mailbox', undefined, true); }
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
    throw error;
  }
  return { id };
}
