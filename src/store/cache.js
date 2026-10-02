// In-memory cache for normalized mail items.
// Normalized shape: { key, provider, account, from, subject, snippet, date, unread, localRead, webLink? }
// `key` is `provider + ':' + encodeURIComponent(account) + ':' + id`. `localRead` is never cleared by a merge.

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
      ...(typeof item.webLink === "string" ? { webLink: item.webLink } : {}),
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

// Only a completed bounded query is authoritative for this account.
export function reconcileAccount(acct, items, complete = true) {
  if (complete) {
    const present = new Set(items.map(i => i.key));
    for (const [key, item] of byKey) {
      if (item.provider === acct.provider && item.account === acct.account && !present.has(key)) byKey.delete(key);
    }
  }
  return mergeMessages(items);
}

// Provider-confirmed changes; the worker owns serialization with polling.
export function applyMailboxChange(key, action, replacement) {
  const item = byKey.get(key);
  if (action === "read" && item) {
    item.unread = false;
    item.localRead = false;
  } else if (action === "unread" && item) {
    item.unread = true;
    item.localRead = false;
  } else if (action === "trash") {
    byKey.delete(key);
  } else if (action === "undo" && replacement) {
    mergeMessages([replacement]);
  }
}
