// Private Sync restore adapter. Only the Inbox label operation is constructed.
// Gmail's published client builds SZB/ATj metadata from GLOBALS and capabilities;
// the source mapping and fresh real-account probe are recorded in acceptance.
// Session metadata is transient: never persist or log this header or token.
export function parseGmailUndoAppInfo(html, key) {
  if (typeof html !== 'string' || html.length > 2 * 1024 * 1024) return null;
  const matches = [...html.matchAll(/\bvar GLOBALS\s*=\s*(\[)/g)];
  if (matches.length !== 1) return null;
  const start = matches[0].index + matches[0][0].length - 1;
  let end = start, depth = 0, quoted = false, escaped = false;
  for (; end < html.length; end++) {
    const char = html[end];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '[') depth++;
    else if (char === ']' && !--depth) { end++; break; }
  }
  try {
    const globals = JSON.parse(html.slice(start, end));
    const cl = globals[2], build = globals[3];
    if (!Number.isInteger(cl) || cl <= 0 || cl > 2147483647
      || typeof build !== 'string' || !/^[a-zA-Z0-9._-]{1,128}$/.test(build)
      || typeof key !== 'string' || !key || globals[9] !== key) return null;
    // Unconditional capability fields from Google's ATj constructor. Optional
    // feature flags, device IDs, feature-map counters and trace fields omitted.
    const flags = Array(115).fill(null);
    [13, 16, 17, 19, 26, 49, 71, 104, 113, 115].forEach(field => flags[field - 1] = 1);
    flags[9] = 1; flags[31] = 0; flags[83] = 0;
    return JSON.stringify([null, null, flags, null, key, null, 25, build, 1, 4, '', null, null, null, null, cl]);
  } catch { return null; }
}

export function buildGmailUndoRequest(base, id, members, token, appInfo) {
  const slot = Number(/\/u\/(\d+)\//.exec(base)[1]);
  const operation = [1, ['thread-f:' + BigInt('0x' + id).toString(),
    [null, null, null, null, null, null,
      [['^i'], ['^a', '^t_z', '^us', '^k', '^s'], members.map(id => 'msg-f:' + BigInt('0x' + id).toString()),
        null, null, null, null, null, null, null, null, [null, []]]]]];
  return {
    url: `https://mail.google.com/sync/u/${slot}/i/s?hl=en&c=0&rt=r&pt=ji`,
    options: {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Framework-Xsrf-Token': token,
        'X-Same-Domain': '1', 'X-Google-BTD': '1', 'X-Gmail-BTAI': appInfo },
      body: JSON.stringify([null, [[operation]], [1, null, null, null, [null, 0], null, 1], [null, 1, Date.now(), 0, 77], 2]),
    },
  };
}
