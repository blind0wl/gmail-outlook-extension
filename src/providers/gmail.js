// Gmail read-only adapter. Normalizes Gmail API message resources into the
// cache shape from src/store/cache.js:
// { key, provider, account, from, subject, snippet, date, unread, localRead }
// Only issues GET requests; never requests write scopes. The OAuth token is
// taken as a function parameter (auth wiring comes from Task 6 at runtime).

const LIST_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

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

async function getJson(url, token, op, extra, deadline) {
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: deadline
        ? AbortSignal.any([deadline, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
    });
  } catch {
    throw new GmailFetchError(op, extra);
  }
  if (!res.ok) throw new GmailFetchError(op, { status: res.status, ...extra });
  try {
    return await res.json();
  } catch {
    throw new GmailFetchError(`${op} parse`, { status: res.status, ...extra });
  }
}

function header(payload, name) {
  const found = payload?.headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? "";
}

export function normalizeGmailMessage(raw, account) {
  const dateHeader = header(raw.payload, "Date");
  const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
  const date = Number.isNaN(parsed) ? Number(raw.internalDate) || 0 : parsed;
  return {
    key: "gmail:" + encodeURIComponent(account) + ":" + raw.id,
    provider: "gmail",
    account,
    from: header(raw.payload, "From"),
    subject: header(raw.payload, "Subject"),
    snippet: raw.snippet ?? "",
    date,
    unread: raw.labelIds?.includes("UNREAD") ?? false,
    localRead: false,
  };
}

export async function fetchGmailMessages(token, since) {
  const deadline = AbortSignal.timeout(45_000);
  const base = new URLSearchParams({ maxResults: "25" });
  since ??= Date.now() - 7 * 86400000;
  if (since) base.set("q", `after:${Math.floor(since / 1000)} in:inbox`);
  const ids = [];
  let pageToken;
  let pages = 0;
  do {
    const params = new URLSearchParams(base);
    if (pageToken) params.set("pageToken", pageToken);
    const list = await getJson(
      `${LIST_URL}?${params}`,
      token,
      "list",
      undefined,
      deadline,
    );
    if (list.messages?.length) {
      for (const { id } of list.messages.slice(0, 25)) ids.push(id);
    }
    pageToken = list.nextPageToken;
  } while (pageToken && ++pages < 4);
  if (!ids.length) return Object.assign([], { complete: !pageToken });
  const profile = await getJson(
    PROFILE_URL,
    token,
    "profile",
    undefined,
    deadline,
  );
  const account = profile.emailAddress ?? "gmail";
  const out = [];
  for (const id of ids) {
    const detail = await getJson(
      `${LIST_URL}/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      token,
      "get",
      { id, account },
      deadline,
    );
    out.push(normalizeGmailMessage(detail, account));
  }
  return Object.assign(out, { complete: !pageToken });
}
