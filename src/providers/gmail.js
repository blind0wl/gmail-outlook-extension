// Gmail session-cookie transport. Reads the per-account Atom unread feeds at
// mail.google.com/mail/u/<n>/feed/atom using the browser's Gmail session
// (fetch with credentials:include). No OAuth, no tokens, no Cloud project:
// if you are logged into Gmail in the browser, the account is readable.
// Normalizes into the cache shape from src/store/cache.js:
// { key, provider, account, from, subject, snippet, date, unread, localRead }
// Feed entries are unread inbox mail only; read mail vanishes from the feed
// and the worker treats absence accordingly. Only issues GET requests.

// Sanitized fetch error. Carries only safe identifiers (operation, HTTP
// status, message id, account) plus a timestamp — never subject, snippet,
// or response body content.
export class GmailFetchError extends Error {
  constructor(op, { status, id, account } = {}) {
    const at = new Date().toISOString();
    let message = `gmail ${op} failed`;
    if (status !== undefined) message += `: ${status}`;
    if (id !== undefined) message += ` id=${id}`;
    message += ` at=${at}`;
    super(message);
    this.name = "GmailFetchError";
    this.op = op;
    if (status !== undefined) this.status = status;
    if (id !== undefined) this.id = id;
    if (account !== undefined) this.account = account;
    this.at = at;
  }
}

const FEED_HOST = "https://mail.google.com";
const MAX_SLOTS = 10;

function feedUrl(slot) {
  return `${FEED_HOST}/mail/u/${slot}/feed/atom`;
}

function decodeXml(s) {
  return String(s ?? "")
    .replace(/&(lt|gt|amp|quot|apos);/g, (_, e) =>
      ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" })[e],
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function firstGroup(re, s) {
  const m = re.exec(s);
  return m ? decodeXml(m[1]).trim() : "";
}

// Workers have no DOMParser, so entries come out with flat regexps. The
// feed is machine-generated XML with a stable shape.
export function parseFeed(xml, slot) {
  const text = String(xml ?? "").replace(/^\s*<\?xml[^?]*\?>\s*/, "");
  if (!text.startsWith("<feed")) {
    // A login page or anything else means this slot has no Gmail session.
    throw new GmailFetchError("feed-auth", { status: 401 });
  }
  const account = firstGroup(
    /<title>\s*Gmail - Inbox for ([^<]+)<\/title>/i,
    text,
  ).toLowerCase();
  if (!account) throw new GmailFetchError("feed parse", { status: 200 });
  const fullcount = Number(firstGroup(/<fullcount>(\d+)<\/fullcount>/i, text)) || 0;
  const entries = [];
  const blocks = text.match(/<entry>([\s\S]*?)<\/entry>/gi) ?? [];
  for (const block of blocks) {
    const link = firstGroup(/<link[^>]*href="([^"]+)"/i, block);
    const id =
      firstGroup(/#inbox\/([0-9a-f]+)/i, link) ||
      firstGroup(/[?&]message_id=([^"&]+)/i, link);
    if (!id) continue;
    const issuedMatch = /<(?:issued|modified)>([^<]+)<\/(?:issued|modified)>/i.exec(block);
    const issued = issuedMatch ? decodeXml(issuedMatch[1]).trim() : "";
    entries.push({
      id,
      from: firstGroup(/<author>[\s\S]*?<name>([^<]*)<\/name>/i, block),
      subject: firstGroup(/<title>([\s\S]*?)<\/title>/i, block),
      snippet: firstGroup(/<summary>([\s\S]*?)<\/summary>/i, block),
      date: issued ? Date.parse(issued) || 0 : 0,
    });
  }
  return { account, fullcount, entries, slot };
}

export function normalizeGmailMessage(raw, account) {
  const addr = String(account ?? "").toLowerCase();
  return {
    key: "gmail:" + encodeURIComponent(addr) + ":" + raw.id,
    provider: "gmail",
    account: addr,
    from: raw.from ?? "",
    subject: raw.subject ?? "",
    snippet: raw.snippet ?? "",
    date: Number(raw.date) || 0,
    unread: true,
    localRead: false,
  };
}

// Aborted fetches (our own timeouts) are transient blips; any other
// throw means the request never reached a server, which the worker
// reads as offline via the -offline op suffix.
function aborted(err) {
  return err?.name === "TimeoutError" || err?.name === "AbortError";
}

async function fetchSlot(slot) {
  let res;
  try {
    res = await fetch(feedUrl(slot), {
      credentials: "include",
      // A poll must reflect current unread mail, including conversations that
      // remained in Inbox after an unconfirmed action. Never reuse an older
      // HTTP snapshot for Refresh or account-slot ownership discovery.
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (fetchErr) {
    throw new GmailFetchError(aborted(fetchErr) ? "feed" : "feed-offline");
  }
  if (res.type === "opaqueredirect" || res.status === 301 || res.status === 302) {
    throw new GmailFetchError("feed-auth", { status: 401 });
  }
  if (res.status === 401 || res.status === 403) {
    throw new GmailFetchError("feed-auth", { status: res.status });
  }
  if (res.status === 404) {
    const err = new GmailFetchError("feed-slot", { status: 404 });
    err.slotAbsent = true;
    throw err;
  }
  if (!res.ok) throw new GmailFetchError("feed", { status: res.status });
  let text;
  try {
    text = await res.text();
  } catch {
    throw new GmailFetchError("feed parse", { status: res.status });
  }
  return parseFeed(text, slot);
}

// token is accepted for interface symmetry with the Outlook adapter and
// ignored: the session cookie authenticates. since filters by entry date.
// onlyAccount scopes the result to one configured address; slots still
// probe in order because slot numbers are unstable across sessions.
// Probes slots 0..9 in order and stops at the first absent slot; a slot
// past 0 that answers auth-failure is skipped, not terminal. Throws
// feed-auth when slot 0 has no session (user is logged out of Gmail), and
// when onlyAccount matches no probed slot (that address has no session).
// The returned array carries complete:true plus totalUnread (the feed's
// exact unread count, which can exceed the ~20 returned entries).
export async function fetchGmailMessages(token, since, onlyAccount) {
  void token;
  since ??= Date.now() - 7 * 86400000;
  const out = [];
  let totalUnread = 0;
  let matched = !onlyAccount;
  for (let slot = 0; slot < MAX_SLOTS; slot++) {
    let feed;
    try {
      feed = await fetchSlot(slot);
    } catch (err) {
      if (err?.slotAbsent) break;
      // A dead middle slot must not hide live accounts at higher slots.
      if (slot > 0 && err?.op === "feed-auth") continue;
      throw err;
    }
    if (onlyAccount && feed.account.toLowerCase() !== String(onlyAccount).toLowerCase()) continue;
    matched = true;
    totalUnread += feed.fullcount;
    for (const entry of feed.entries) {
      if (entry.date && entry.date < since) continue;
      out.push(normalizeGmailMessage(entry, feed.account));
    }
  }
  if (!matched) {
    // The configured address has no session in this browser profile: no
    // slot carried it, so an empty success would strand the account with
    // no mail and no next step. Auth failure opens the login tab upstream.
    throw new GmailFetchError("feed-auth", { status: 401, account: onlyAccount });
  }
  out.sort((a, b) => b.date - a.date);
  return Object.assign(out, { complete: true, totalUnread });
}
