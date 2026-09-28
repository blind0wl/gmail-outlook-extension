// In-memory cache for normalized mail items.
// Normalized shape: { key, provider, account, from, subject, snippet, date, unread, localRead }
// `key` is `provider + ':' + id`. `localRead` is never cleared by a merge.

const MAX_ITEMS = 200;
const EXPIRY_MS = 7 * 24 * 3600 * 1000;

const byKey = new Map();

function newestFirst(items) {
  return [...items].sort((a, b) => b.date - a.date);
}

export function mergeMessages(items) {
  for (const item of items) {
    const keptRead = byKey.get(item.key)?.localRead === true;
    byKey.set(item.key, {
      key: item.key,
      provider: item.provider,
      account: item.account,
      from: item.from,
      subject: item.subject,
      snippet: item.snippet,
      date: item.date,
      unread: item.unread,
      localRead: keptRead || item.localRead === true,
    });
  }
  for (const item of newestFirst(byKey.values()).slice(MAX_ITEMS)) {
    byKey.delete(item.key);
  }
  return { items: getInbox() };
}

export function setLocalRead(key) {
  const item = byKey.get(key);
  if (item) item.localRead = true;
}

export function getInbox() {
  return newestFirst(byKey.values());
}

export function pruneCache(now) {
  for (const [key, item] of byKey) {
    if (now - item.date > EXPIRY_MS) byKey.delete(key);
  }
  return getInbox();
}
