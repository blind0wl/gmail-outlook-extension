// Account records for the extension. Single owner of the "accounts" key
// in chrome.storage.local plus the record shape, so the worker and the
// popup never scatter keys or field names.
//
// Record shape: { provider: "gmail"|"outlook", account: address,
//   enabled?, notify?, clientId? }.
// `account` is canonical (existing polls key on it); `address` is accepted
// as an alias on read. `enabled` defaults to true (absent means enabled).
// `clientId` carries the Entra application id on outlook records; the
// worker configures Microsoft auth from it once (public id, not a secret).

export const ACCOUNTS_KEY = "accounts";

export function normalizeAccount(raw = {}) {
  // An empty clientId (the popup's hidden field submits "") must not
  // survive: "" is not nullish, so it would shadow the baked-in
  // developer default through every `??` in the auth path.
  const clientId = String(raw.clientId ?? "").trim();
  return {
    provider: raw.provider,
    account: String(raw.account ?? raw.address ?? "").trim().toLowerCase(),
    enabled: raw.enabled !== false,
    notify: raw.notify !== false,
    ...(clientId ? { clientId } : {}),
  };
}

export function accountKey(acct) {
  return `${acct.provider}:${String(acct.account ?? acct.address ?? "").toLowerCase()}`;
}

// Address only, for error and status UI (never subject or body).
export function accountAddress(acct) {
  return acct.account ?? acct.address ?? "";
}

// Entra application id from the first outlook record that carries one.
// Null when no outlook account is configured yet.
export function getMicrosoftClientId(accounts = []) {
  for (const acct of accounts) {
    if (acct?.provider === "outlook" && acct?.clientId) return acct.clientId;
  }
  return null;
}

// Normalized account list from storage. Empty without chrome (Node).
export async function loadAccounts() {
  const store = globalThis.chrome?.storage?.local;
  if (!store?.get) return [];
  const data = await store.get(ACCOUNTS_KEY);
  const list = data?.[ACCOUNTS_KEY] ?? [];
  return Array.isArray(list) ? list.map(normalizeAccount) : [];
}

export async function saveAccounts(accounts) {
  const store = globalThis.chrome?.storage?.local;
  if (!store?.set) return;
  await store.set({ [ACCOUNTS_KEY]: accounts });
}
