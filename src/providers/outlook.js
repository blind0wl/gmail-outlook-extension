// Outlook read-only adapter. Normalizes Microsoft Graph message resources
// into the cache shape from src/store/cache.js:
// { key, provider, account, from, subject, snippet, date, unread, localRead }
// Only issues GET requests against Graph (delegated Mail.Read); the app
// never requests Mail.Read.Shared. The OAuth token is taken as a function
// parameter (auth wiring comes from Task 6 at runtime).

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SELECT =
  "subject,from,receivedDateTime,bodyPreview,isRead";

// Sanitized fetch error. Carries only safe identifiers (operation, HTTP
// status, message id, account) plus a timestamp — never subject, preview,
// or response body content.
export class OutlookFetchError extends Error {
  constructor(op, { status, id, account } = {}) {
    const at = new Date().toISOString();
    const parts = [`outlook ${op} failed`];
    if (status !== undefined) parts.push(`status=${status}`);
    if (id !== undefined) parts.push(`id=${id}`);
    parts.push(`at=${at}`);
    super(parts.join(" "));
    this.name = "OutlookFetchError";
    this.op = op;
    if (status !== undefined) this.status = status;
    if (id !== undefined) this.id = id;
    if (account !== undefined) this.account = account;
    this.at = at;
  }
}

async function readJson(url, token, op, extra) {
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new OutlookFetchError(op, extra);
  }
  if (!res.ok) {
    throw new OutlookFetchError(op, { status: res.status, ...extra });
  }
  try {
    return await res.json();
  } catch {
    throw new OutlookFetchError(`${op} parse`, {
      status: res.status,
      ...extra,
    });
  }
}

export function normalizeGraphMessage(raw, account) {
  const parsed = raw.receivedDateTime
    ? Date.parse(raw.receivedDateTime)
    : NaN;
  return {
    key: "outlook:" + raw.id,
    provider: "outlook",
    account,
    from: raw.from?.emailAddress?.address ?? "",
    subject: raw.subject ?? "",
    snippet: raw.bodyPreview ?? "",
    date: Number.isNaN(parsed) ? 0 : parsed,
    unread: raw.isRead === false,
    localRead: false,
  };
}

function listUrl(since) {
  const params = new URLSearchParams({ $top: "25", $select: SELECT });
  if (since) params.set("$filter", `receivedDateTime ge ${new Date(since).toISOString()}`);
  return `${GRAPH_BASE}/me/messages?${params}`;
}

export async function fetchOutlookMessages(token, since) {
  const me = await readJson(
    `${GRAPH_BASE}/me?$select=mail,userPrincipalName`,
    token,
    "profile",
  );
  const account = me.mail ?? me.userPrincipalName ?? "outlook";
  const out = [];
  let next = listUrl(since);
  while (next) {
    const page = await readJson(next, token, "list", { account });
    if (page.value?.length) {
      for (const raw of page.value) {
        out.push(normalizeGraphMessage(raw, account));
      }
    }
    next = page["@odata.nextLink"] ?? null;
  }
  return out;
}
