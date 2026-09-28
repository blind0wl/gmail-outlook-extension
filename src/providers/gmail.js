// Gmail read-only adapter. Normalizes Gmail API message resources into the
// cache shape from src/store/cache.js:
// { key, provider, account, from, subject, snippet, date, unread, localRead }
// Only issues GET requests; never requests write scopes. The OAuth token is
// taken as a function parameter (auth wiring comes from Task 6 at runtime).

const LIST_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

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
    key: "gmail:" + raw.id,
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
  const params = new URLSearchParams({ format: "metadata", maxResults: "25" });
  if (since) {
    const afterSec = Math.floor(since / 1000);
    params.set("q", `after:${afterSec}`);
  }
  const listRes = await fetch(`${LIST_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) throw new Error(`gmail list failed: ${listRes.status}`);
  const list = await listRes.json();
  if (!list.messages?.length) return [];
  const profileRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!profileRes.ok) throw new Error(`gmail profile failed: ${profileRes.status}`);
  const account = (await profileRes.json()).emailAddress ?? "gmail";
  const out = [];
  for (const { id } of list.messages) {
    const detailRes = await fetch(
      `${LIST_URL}/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!detailRes.ok) throw new Error(`gmail get failed: ${detailRes.status}`);
    out.push(normalizeGmailMessage(await detailRes.json(), account));
  }
  return out;
}
