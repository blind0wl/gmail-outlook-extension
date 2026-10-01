// Diagnostic-only Gmail search. No mailbox mutation, cache or journal writes.
import { gmailSession } from './mail-actions.js';
import { parseFeed } from './gmail.js';
import { decodeGmailReply, MAX_GMAIL_REPLY_BYTES as MAX_BYTES } from './gmail-reply.js';

const MAX_TARGETS = 80;
const unknown = () => ({ recognized: false, ids: [], returned: 0 });

export function parseGmailSearchTargets(text) {
  const decoded = decodeGmailReply(text);
  if (decoded.issue) return unknown();
  try {
    let rows = null;
    for (const payload of decoded.payloads) {
      const entries = payload?.[1]?.[0]?.[2]?.[5];
      if (!Array.isArray(entries)) continue;
      // Multiple candidate result sets are ambiguous, not stronger evidence.
      if (rows !== null || entries.length > MAX_TARGETS) return unknown();
      rows = entries;
    }
    if (rows === null || rows.some(row => !Array.isArray(row)
      || typeof row[11] !== 'string' || !/^[a-f0-9]+$/i.test(row[11]))) return unknown();
    return { recognized: true, ids: rows.map(row => row[11].toLowerCase()), returned: rows.length };
  } catch { return unknown(); }
}

// Only enums, booleans and array counts. Never include a string from Gmail,
// object keys, identifiers, subject/body fields, URLs or exception messages.
export function summarizeGmailSearchReply(text) {
  const decoded = decodeGmailReply(text);
  let firstFrame = null;
  if (decoded.format === 'length-framed') {
    const cleaned = text.replace(/^\)\]\}'\s*/, '').trim();
    const header = /^(\d{1,7})&/.exec(cleaned);
    if (header && Number(header[1]) <= MAX_BYTES) {
      const rest = cleaned.slice(header[0].length);
      const whitespace = /^\s*/.exec(rest)[0].length;
      const start = rest[whitespace];
      firstFrame = {
        declaredLength: Number(header[1]), delimiterWhitespace: whitespace,
        payloadType: start === '[' ? 'array' : start === '{' ? 'object'
          : start === '<' ? 'markup' : start === undefined ? 'empty' : 'other',
      };
    }
  }
  const shape = value => Array.isArray(value) ? { type: 'array', length: value.length }
    : { type: value === null ? 'null' : value === undefined ? 'missing' : typeof value };
  return {
    format: decoded.format, issue: decoded.issue, frames: decoded.payloads.length,
    ...(decoded.attempts ? { framingAttempts: decoded.attempts } : {}),
    ...(firstFrame ? { firstFrame } : {}),
    sessionChallengeMarker: typeof text === 'string' && text.length <= MAX_BYTES && text.includes('/spreauth'),
    structure: decoded.payloads.slice(0, 8).map(payload => {
      const rows = payload?.[1]?.[0]?.[2]?.[5];
      const targetTypes = { legacyHex: 0, otherString: 0, other: 0 };
      if (Array.isArray(rows)) for (const row of rows.slice(0, MAX_TARGETS)) {
        const id = Array.isArray(row) ? row[11] : undefined;
        targetTypes[typeof id !== 'string' ? 'other' : /^[a-f0-9]+$/i.test(id) ? 'legacyHex' : 'otherString']++;
      }
      return { root: shape(payload), first: shape(payload?.[0]), second: shape(payload?.[1]),
        query: shape(payload?.[1]?.[0]), container: shape(payload?.[1]?.[0]?.[2]),
        rows: shape(rows), targetTypes };
    }),
  };
}

async function readRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options, credentials: 'include', cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error('verification unavailable');
  return response;
}

export async function inspectGmailTrash(account, ids) {
  if (typeof account !== 'string' || !account || !Array.isArray(ids)
    || !ids.length || ids.length > MAX_TARGETS
    || ids.some(id => typeof id !== 'string' || !/^[a-f0-9]+$/i.test(id)))
    return { ok: false, code: 'invalid-targets' };
  const unconfirmed = () => ids.map(() => 'not-confirmed');
  try {
    const { base, csrf, key } = await gmailSession(account);
    // This is the reference client's SEARCH payload, not an action payload.
    // It contains no mutation code or target IDs; only the fixed Trash query.
    const body = new URLSearchParams();
    body.set('s_jr', JSON.stringify([null, [
      [null, null, null, null, null, null, [null, true, false]],
      [null, [null, 'in:trash', 0, null, MAX_TARGETS, null, null, null, false, [], [], true]],
    ], 2, null, null, null, key]));
    const url = base + 's/?' + new URLSearchParams({
      v: 'or', ik: key, at: csrf, subui: 'chrome', hl: 'en', ts: String(Date.now()),
    });
    const response = await readRequest(url, { method: 'POST', body });
    const text = await response.text();
    const parsed = parseGmailSearchTargets(text);
    if (!parsed.recognized)
      return { ok: false, code: 'unrecognized-search', status: response.status,
        diagnostic: summarizeGmailSearchReply(text), results: unconfirmed() };
    // Recheck ownership after the query before attributing any returned target.
    const check = await readRequest(base + 'feed/atom');
    if (parseFeed(await check.text(), Number(/\/u\/(\d+)\//.exec(base)[1])).account !== account.toLowerCase())
      return { ok: false, code: 'account-changed', results: unconfirmed() };
    const found = new Set(parsed.ids);
    return { ok: true, status: response.status, returned: parsed.returned,
      results: ids.map(id => found.has(id.toLowerCase()) ? 'verified-trash' : 'not-confirmed') };
  } catch {
    // Never expose exception text, session values, response bodies or identities.
    return { ok: false, code: 'verification-unavailable', results: unconfirmed() };
  }
}
