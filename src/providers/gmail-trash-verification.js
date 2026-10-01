// Diagnostic-only Gmail search. No mailbox mutation, cache or journal writes.
import { gmailSession } from './mail-actions.js';
import { parseFeed } from './gmail.js';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TARGETS = 80;
const unknown = () => ({ recognized: false, ids: [], returned: 0 });

// Reference client's search shape: j[1][0][2][5], target at row[11].
// Consume byte-length frames rather than splitting inside mail strings.
// Unsupported formats fail closed; subject/body fields are never returned.
export function parseGmailSearchTargets(text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) return unknown();
  const cleaned = text.replace(/^\)\]\}'\s*/, '').trim();
  const bytes = new TextEncoder().encode(cleaned);
  if (bytes.length > MAX_BYTES) return unknown();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const payloads = [];
  try {
    if (cleaned.startsWith('[')) payloads.push(JSON.parse(cleaned));
    else {
      let offset = 0;
      while (offset < bytes.length) {
        while ([9, 10, 13, 32].includes(bytes[offset])) offset++;
        if (offset === bytes.length) break;
        let length = 0, digits = 0;
        while (bytes[offset] >= 48 && bytes[offset] <= 57) {
          length = length * 10 + bytes[offset++] - 48;
          if (++digits > 7) return unknown();
        }
        if (!digits || bytes[offset++] !== 38 || length < 1
          || offset + length > bytes.length || payloads.length >= 32) return unknown();
        payloads.push(JSON.parse(decoder.decode(bytes.slice(offset, offset + length))));
        offset += length;
      }
    }
    let rows = null;
    for (const payload of payloads) {
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
    const parsed = parseGmailSearchTargets(await response.text());
    if (!parsed.recognized)
      return { ok: false, code: 'unrecognized-search', status: response.status, results: unconfirmed() };
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
