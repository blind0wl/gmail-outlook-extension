// Pure provider-link builders for the A v5 popup.
// No chrome APIs, no DOM, no fetch — unit-testable under Node.
// The popup itself only opens these URLs in tabs; it never fetches them.

export const GMAIL_SEARCH_URL = "https://mail.google.com/mail/#search";
// Verified Outlook web search view: personal-variant host with the
// documented /mail/0/search path used across Outlook web deep links.
export const OUTLOOK_SEARCH_URL = "https://outlook.live.com/mail/0/search";

const GMAIL_THREAD_BASE = "https://mail.google.com/mail/";
const OUTLOOK_MAIL_BASE = "https://outlook.live.com/mail/";

// Suffix of the normalized cache key `provider + ':' + id`.
export function messageIdOf(key) {
  const raw = String(key ?? "");
  const idx = raw.indexOf(":");
  return idx === -1 ? raw : raw.slice(idx + 1);
}

// Ordered Gmail account addresses from the configured `accounts` list
// (chrome.storage.local key "accounts", shape { provider, account, ... }).
// Position in this list is the Gmail web authuser slot.
export function gmailAccountOrder(accounts) {
  return (accounts ?? [])
    .filter((a) => a && a.provider === "gmail" && typeof a.account === "string")
    .map((a) => a.account);
}

// Account-aware Gmail thread link: /mail/u/<slot>/#inbox/<id> so a card
// from the second Gmail account opens against its own mailbox, not the
// default web session. Unknown account falls back to the slot-less URL.
export function gmailThreadUrl(account, id, gmailAccounts) {
  const idx = (gmailAccounts ?? []).indexOf(account);
  const base = idx === -1 ? GMAIL_THREAD_BASE : `${GMAIL_THREAD_BASE}u/${idx}/`;
  return `${base}#inbox/${encodeURIComponent(id)}`;
}

// Account-aware Outlook thread link: the account address in the path
// addresses that mailbox instead of hardcoded slot 0. Missing account
// falls back to slot 0.
export function outlookThreadUrl(account, id) {
  const slot = account ? encodeURIComponent(account) : "0";
  return `${OUTLOOK_MAIL_BASE}${slot}/inbox/id/${encodeURIComponent(id)}`;
}

export function threadUrl(item, gmailAccounts) {
  const id = messageIdOf(item.key);
  if (item.provider === "outlook") return outlookThreadUrl(item.account, id);
  return gmailThreadUrl(item.account, id, gmailAccounts);
}

// Search destination follows the active filter: Gmail search for All and
// Gmail, the verified Outlook search view for the Outlook filter.
export function searchUrl(filter) {
  return filter === "outlook" ? OUTLOOK_SEARCH_URL : GMAIL_SEARCH_URL;
}
