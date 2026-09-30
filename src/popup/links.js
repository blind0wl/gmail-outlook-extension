// Pure provider-link builders for the A v5 popup.
// No chrome APIs, no DOM, no fetch — unit-testable under Node.
// The popup itself only opens these URLs in tabs; it never fetches them.
//
// Microsoft documents Graph webLink for opening a message. Synthesized
// links remain compatibility fallbacks requiring manual acceptance.

const GMAIL_THREAD_BASE = "https://mail.google.com/mail/";
const OUTLOOK_MAIL_BASE = "https://outlook.live.com/mail/";
const OUTLOOK_WEB_ORIGINS = new Set([
  "https://outlook.live.com",
  "https://outlook.office.com",
  "https://outlook.office365.com",
]);

// Cached/provider data is untrusted at the navigation boundary. Preserve
// Microsoft's encoded message URL only on exact HTTPS Outlook origins.
function safeOutlookWebLink(value, account) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (!OUTLOOK_WEB_ORIGINS.has(url.origin) || url.username || url.password)
      return null;
    // Outlook.com otherwise uses the browser's active mailbox, which can
    // differ from the account whose Graph session fetched this message.
    if (url.origin === "https://outlook.live.com" && typeof account === "string" && account)
      url.searchParams.set("login_hint", account);
    return url.href;
  } catch {
    return null;
  }
}

// Extract the message ID from provider:encoded-account:id; accept legacy keys.
export function messageIdOf(key) {
  const raw = String(key ?? "");
  const first = raw.indexOf(":");
  const second = raw.indexOf(":", first + 1);
  const idx = second === -1 ? first : second;
  return idx === -1 ? raw : raw.slice(idx + 1);
}

// Account-aware Gmail thread link. The mailbox is pinned with
// ?authuser=<account-email>: the /mail/u/<N>/ numeric slot follows browser
// login order and is unknowable here, and the /mail/u/<email>/ path form
// 404s — ?authuser redirects to the right mailbox with the fragment kept.
// Missing account falls back to the slot-less URL (default mailbox).
export function gmailThreadUrl(account, id) {
  const base = account
    ? `${GMAIL_THREAD_BASE}?authuser=${encodeURIComponent(account)}`
    : GMAIL_THREAD_BASE;
  return `${base}#inbox/${encodeURIComponent(id)}`;
}

// Legacy fallback for cache entries without a safe Graph webLink. This
// synthesized format does not reliably select the message; refresh mail
// to obtain the provider URL. Missing account falls back to slot 0.
export function outlookThreadUrl(account, id) {
  const slot = account ? encodeURIComponent(account) : "0";
  return `${OUTLOOK_MAIL_BASE}${slot}/inbox/id/${encodeURIComponent(id)}`;
}

export function threadUrl(item) {
  const id = messageIdOf(item.key);
  if (item.provider === "outlook")
    return safeOutlookWebLink(item.webLink, item.account) ?? outlookThreadUrl(item.account, id);
  return gmailThreadUrl(item.account, id);
}

// True when a card-level keydown should mark read: Enter/Space targeted at
// the card itself. Keydowns from nested controls (the Open button) return
// false so the button keeps its native Enter/Space activation.
export function isCardSelfKeydown(event) {
  if (!event || (event.key !== "Enter" && event.key !== " ")) return false;
  return event.target === event.currentTarget;
}
