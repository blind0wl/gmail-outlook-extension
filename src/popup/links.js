// Pure provider-link builders for the A v5 popup.
// No chrome APIs, no DOM, no fetch — unit-testable under Node.
// The popup itself only opens these URLs in tabs; it never fetches them.
//
// Neither vendor officially documents these deep-link formats (see the
// fix-round-2 report for sources), so every format below is also covered
// by a manual tick in tests/popup-checklist.md.

export const GMAIL_SEARCH_URL = "https://mail.google.com/mail/#search";

const GMAIL_THREAD_BASE = "https://mail.google.com/mail/";
const OUTLOOK_MAIL_BASE = "https://outlook.live.com/mail/";

// Suffix of the normalized cache key `provider + ':' + id`.
export function messageIdOf(key) {
  const raw = String(key ?? "");
  const idx = raw.indexOf(":");
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

// Account-aware Outlook thread link: the account address in the path
// addresses that mailbox instead of hardcoded slot 0. Missing account
// falls back to slot 0.
export function outlookThreadUrl(account, id) {
  const slot = account ? encodeURIComponent(account) : "0";
  return `${OUTLOOK_MAIL_BASE}${slot}/inbox/id/${encodeURIComponent(id)}`;
}

export function threadUrl(item) {
  const id = messageIdOf(item.key);
  if (item.provider === "outlook") return outlookThreadUrl(item.account, id);
  return gmailThreadUrl(item.account, id);
}

// Outlook search view, addressed to the given account's mailbox the same
// way thread links are (Outlook web /mail/<slot>/search path). Missing
// account falls back to slot 0.
export function outlookSearchUrl(account) {
  const slot = account ? encodeURIComponent(account) : "0";
  return `${OUTLOOK_MAIL_BASE}${slot}/search`;
}

// Search destination follows the active filter: Gmail search for All and
// Gmail, the account-aware Outlook search view for the Outlook filter.
export function searchUrl(filter, account) {
  if (filter === "outlook") return outlookSearchUrl(account);
  return GMAIL_SEARCH_URL;
}

// True when a card-level keydown should mark read: Enter/Space targeted at
// the card itself. Keydowns from nested controls (the Open button) return
// false so the button keeps its native Enter/Space activation.
export function isCardSelfKeydown(event) {
  if (!event || (event.key !== "Enter" && event.key !== " ")) return false;
  return event.target === event.currentTarget;
}
