import { authCodeExpiresAt, detectAuthCode } from "./detector.js";

// One path handles provider mail and local demo mail. Secret codes are passed
// only to the session store and clipboard callback, never to notification UI.
export async function processFreshMail(items, deps = {}) {
  const now = deps.now ?? Date.now();
  const ordinary = [];
  const detected = [];
  let attemptedAutoCopy = false;
  const autoCopyUnavailable = new Set();
  const orderedItems = [...(items ?? [])].sort((a, b) => Number(b.date) - Number(a.date));
  for (const item of orderedItems) {
    let result = detectAuthCode(item, { now });
    const previewCode = result.status === "code";
    const shouldFetchBody = deps.fetchBody && (
      (result.status === "none" && result.authLike) || previewCode
    );
    if (shouldFetchBody) {
      try {
        const full = await deps.fetchBody(item);
        if (full?.ok && typeof full.content === "string") {
          const fullResult = detectAuthCode(item, {
            body: full.content,
            contentType: full.contentType,
            now,
          });
          result = fullResult;
        } else if (previewCode && deps.autoCopy === true) {
          autoCopyUnavailable.add(item.key);
        }
      } catch {
        // Keep the regular mail alert; provider body errors never expose content.
        if (previewCode && deps.autoCopy === true) autoCopyUnavailable.add(item.key);
      }
    }

    if (result.status !== "code") {
      if (deps.codeOnly !== true) ordinary.push(item);
      continue;
    }

    const expiresAt = authCodeExpiresAt(result.date ?? item.date, now);
    const version = Number(item.date) || now;
    const saved = await deps.saveCode?.(item.key, result.code, expiresAt, now, version);
    if (saved === false) continue;
    await deps.onCodeAvailable?.(item.key, true);
    let copied = false;
    if (deps.autoCopy === true && !attemptedAutoCopy && !autoCopyUnavailable.has(item.key)) {
      attemptedAutoCopy = true;
      try { copied = (await deps.copyCode?.(result.code)) === true; }
      catch { copied = false; }
    }
    await deps.notifyCode?.(item, { copied, expiresAt });
    detected.push(item.key);
  }
  if (ordinary.length) await deps.notifyMail?.(ordinary);
  return {
    detected,
    ordinary: ordinary.map((item) => item.key),
    autoCopyAttempted: attemptedAutoCopy,
  };
}
