// Conservative local detection for short-lived authentication codes.
// Never call this with data that will be logged or persisted as a code.

export const AUTH_CODE_TTL_MS = 10 * 60_000;
export const AUTH_MESSAGE_MAX_AGE_MS = 10 * 60_000;
const MAX_FUTURE_SKEW_MS = 5 * 60_000;

const AUTH_CONTEXT = /\b(?:verification|verify|sign[\s-]?in|log[\s-]?in|login|authentication|authenticate|one[\s-]?time|pass[\s-]?code|passcode|otp|two[\s-]?factor|2fa|mfa)\b|\b(?:security|identity)\s+(?:verification\s+)?code\b/i;
const CODE_CONTEXT = /\b(?:code|pass[\s-]?code|passcode|otp|pin)\b/i;
const TOKEN = /(?<![a-z0-9])[a-z0-9]{4,10}(?![a-z0-9])/gi;

function htmlToText(value) {
  return String(value ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<br\s*\/?\s*>|<\/p\s*>|<\/div\s*>|<\/li\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function validToken(token) {
  if (/^\d+$/.test(token)) {
    if (token.length < 4 || token.length > 8) return false;
    // Do not treat common years as one-time codes.
    if (token.length === 4 && Number(token) >= 1900 && Number(token) <= 2099)
      return false;
    return true;
  }
  return token.length >= 6 && token.length <= 10
    && /[a-z]/i.test(token) && /\d/.test(token);
}

function contextualTokens(text) {
  const candidates = new Set();
  TOKEN.lastIndex = 0;
  for (const match of text.matchAll(TOKEN)) {
    const token = match[0];
    if (!validToken(token)) continue;
    const start = Math.max(0, match.index - 48);
    const end = Math.min(text.length, match.index + token.length + 48);
    const nearby = text.slice(start, end);
    if (!/\b(?:discount|coupon|order|promo(?:tional)?)\s+(?:verification\s+)?code\b/i.test(nearby)
      && CODE_CONTEXT.test(nearby)) candidates.add(token);
  }
  return [...candidates];
}

function messageDate(item) {
  const value = Number(item?.date);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Returns only a code when one clear candidate is present in an auth-like
// message. Callers must keep the returned code in session memory only.
export function detectAuthCode(item = {}, { body = "", contentType = "text", now = Date.now() } = {}) {
  const subject = String(item.subject ?? "");
  const snippet = String(item.snippet ?? "");
  const bodyText = contentType === "html" ? htmlToText(body) : String(body ?? "");
  const preview = `${subject}\n${snippet}`;
  const allText = `${preview}\n${bodyText}`;
  const authLike = AUTH_CONTEXT.test(allText);
  const date = messageDate(item);
  if (date === null || now - date > AUTH_MESSAGE_MAX_AGE_MS
    || date > now + MAX_FUTURE_SKEW_MS)
    return { status: "expired", authLike, date };

  if (!authLike) return { status: "none", authLike: false, date };
  const candidates = contextualTokens(allText);
  if (candidates.length > 1)
    return { status: "ambiguous", authLike: true, date };
  if (candidates.length === 1)
    return { status: "code", authLike: true, code: candidates[0], date };
  return { status: "none", authLike: true, date };
}

export function authCodeExpiresAt(date, now = Date.now()) {
  const receivedAt = Number(date);
  const freshnessExpiry = Number.isFinite(receivedAt) && receivedAt > 0
    ? receivedAt + AUTH_MESSAGE_MAX_AGE_MS
    : now;
  return Math.min(now + AUTH_CODE_TTL_MS, freshnessExpiry);
}
