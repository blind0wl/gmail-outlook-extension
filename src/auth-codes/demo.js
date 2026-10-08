// Local-only synthetic inbox. These items use their own storage key and
// provider label, so they never enter account polling or mailbox actions.

export const AUTH_CODE_DEMO_INBOX_KEY = "authCodeDemoInbox";
export const AUTH_CODE_DEMO_SEQUENCE_KEY = "authCodeDemoSequence";
export const AUTH_CODE_DEMO_ALARM = "auth-code-demo-sequence";
export const AUTH_CODE_DEMO_ACCOUNT = "local-demo";
export const AUTH_CODE_DEMO_SCENARIOS = [
  "numeric",
  "alphanumeric",
  "body-only",
  "ambiguous",
  "non-code",
  "expired",
];
let generatedSerial = 0;

function randomDigits(length, cryptoObject = globalThis.crypto) {
  const bytes = new Uint32Array(length);
  if (cryptoObject?.getRandomValues) cryptoObject.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 0xffffffff);
  return Array.from(bytes, (byte) => String(byte % 10)).join("");
}

function randomAlphaCode(cryptoObject = globalThis.crypto) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(8);
  if (cryptoObject?.getRandomValues) cryptoObject.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 0xffffffff);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  // Keep each alphanumeric example inside the detector's mixed-token rule.
  chars[0] = "A";
  chars[1] = String((bytes[1] % 8) + 2);
  return chars.join("");
}

function uniqueId(now, cryptoObject = globalThis.crypto) {
  const bytes = new Uint32Array(2);
  if (cryptoObject?.getRandomValues) cryptoObject.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 0xffffffff);
  return `${now}-${Array.from(bytes, (value) => value.toString(36)).join("")}`;
}

export function createDemoEmail(scenario = "numeric", options = {}) {
  const now = options.now ?? Date.now();
  const cryptoObject = options.crypto ?? globalThis.crypto;
  generatedSerial++;
  const id = options.id ?? `${uniqueId(now, cryptoObject)}-${generatedSerial}`;
  const numeric = randomDigits(6, cryptoObject);
  const alpha = randomAlphaCode(cryptoObject);
  const second = randomDigits(6, cryptoObject);
  let subject = "Your sign-in verification code";
  let snippet = `Enter the one-time code ${numeric} to finish signing in.`;
  let body = `Your verification code is ${numeric}. It expires shortly.`;
  let date = now;

  if (scenario === "alphanumeric") {
    body = `Use this sign-in code: ${alpha}`;
    snippet = body;
  } else if (scenario === "body-only") {
    snippet = "Your one-time sign-in code is in the full message.";
    body = `Enter this verification code to continue: ${numeric}`;
  } else if (scenario === "ambiguous") {
    const distinct = second === numeric ? String((Number(second) + 1) % 1_000_000).padStart(6, "0") : second;
    snippet = `Your sign-in code is ${numeric}; a second verification code is ${distinct}.`;
    body = snippet;
  } else if (scenario === "non-code") {
    subject = "Sign-in request approved";
    snippet = "Your sign-in is confirmed. No code is needed.";
    body = snippet;
  } else if (scenario === "expired") {
    snippet = `Your sign-in code is ${numeric}.`;
    body = snippet;
    date = now - 60 * 60_000;
  } else if (scenario !== "numeric") {
    throw new TypeError("Unknown demo scenario");
  }

  return {
    key: `demo:${AUTH_CODE_DEMO_ACCOUNT}:${id}`,
    provider: "demo",
    account: AUTH_CODE_DEMO_ACCOUNT,
    from: "Local auth code demo",
    subject,
    snippet,
    date,
    unread: true,
    localRead: false,
    demoScenario: scenario,
    demoBody: body,
  };
}

function localStore() {
  return globalThis.chrome?.storage?.local;
}

export async function getDemoInbox() {
  const store = localStore();
  if (!store?.get) return [];
  const data = await store.get(AUTH_CODE_DEMO_INBOX_KEY);
  return Array.isArray(data?.[AUTH_CODE_DEMO_INBOX_KEY]) ? data[AUTH_CODE_DEMO_INBOX_KEY] : [];
}

export async function addDemoEmails(items) {
  const store = localStore();
  const current = await getDemoInbox();
  const next = [...(items ?? []), ...current].slice(0, 100);
  if (store?.set) await store.set({ [AUTH_CODE_DEMO_INBOX_KEY]: next });
  return next;
}

export async function getDemoMessage(key) {
  return (await getDemoInbox()).find((item) => item.key === key) ?? null;
}

export async function clearDemoInbox() {
  const store = localStore();
  const current = await getDemoInbox();
  if (store?.set) await store.set({ [AUTH_CODE_DEMO_INBOX_KEY]: [] });
  return current;
}
