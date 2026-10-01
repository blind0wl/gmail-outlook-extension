// Strict decoding shared by Gmail queries. Decoded content stays inside providers.
export const MAX_GMAIL_REPLY_BYTES = 2 * 1024 * 1024;
const MAX_BYTES = MAX_GMAIL_REPLY_BYTES;

// Consume declared-length frames rather than splitting inside mail strings.
// Unsupported formats fail closed; subject/body fields are never returned.
export function decodeGmailReply(text) {
  const fail = (format, issue) => ({ format, issue, payloads: [] });
  if (typeof text !== 'string') return fail('other', 'unsupported-prefix');
  if (text.length > MAX_BYTES) return fail('oversized', 'parse-limit');
  const cleaned = text.replace(/^\)\]\}'\s*/, '').trimStart();
  const bytes = new TextEncoder().encode(cleaned);
  if (bytes.length > MAX_BYTES) return fail('oversized', 'parse-limit');
  if (!cleaned) return fail('empty', 'empty');
  const format = cleaned.startsWith('[') ? 'json' : /^\d+&/.test(cleaned)
    ? 'length-framed' : cleaned.startsWith('<') ? 'html' : 'other';
  if (!['json', 'length-framed'].includes(format)) return fail(format, 'unsupported-prefix');
  if (format === 'json') {
    try { return { format, issue: null, payloads: [JSON.parse(cleaned)] }; }
    catch { return fail(format, 'invalid-json'); }
  }
  const candidates = [];
  const attempts = [];
  for (const unit of ['utf8', 'utf16']) for (const skipDelimiter of [false, true]) {
    const payloads = [];
    let offset = 0, issue = null;
    try {
      while (offset < cleaned.length) {
        offset += /^\s*/.exec(cleaned.slice(offset))[0].length;
        if (offset === cleaned.length) break;
        const header = /^(\d{1,7})&/.exec(cleaned.slice(offset));
        const length = header ? Number(header[1]) : 0;
        if (!length || length > MAX_BYTES || payloads.length >= 32) { issue = 'invalid-frame'; break; }
        offset += header[0].length;
        if (skipDelimiter) offset += /^\s*/.exec(cleaned.slice(offset))[0].length;
        let chunk;
        if (unit === 'utf16') {
          if (offset + length > cleaned.length) { issue = 'invalid-frame'; break; }
          chunk = cleaned.slice(offset, offset + length);
        } else {
          const remaining = new TextEncoder().encode(cleaned.slice(offset));
          if (length > remaining.length) { issue = 'invalid-frame'; break; }
          chunk = new TextDecoder('utf-8', { fatal: true }).decode(remaining.slice(0, length));
        }
        payloads.push(JSON.parse(chunk));
        offset += chunk.length;
      }
    } catch { issue = 'invalid-json'; }
    attempts.push({ unit, skipDelimiter, issue });
    if (!issue) candidates.push(payloads);
  }
  if (!candidates.length) return { ...fail(format, attempts.some(a => a.issue === 'invalid-json')
    ? 'invalid-json' : 'invalid-frame'), attempts };
  const canonical = JSON.stringify(candidates[0]);
  if (candidates.some(candidate => JSON.stringify(candidate) !== canonical))
    return { ...fail(format, 'ambiguous-framing'), attempts };
  return { format, issue: null, payloads: candidates[0], attempts };
}

