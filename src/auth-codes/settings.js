export const AUTH_CODE_AUTO_COPY_KEY = "authCodeAutoCopy";

// Opt-in by design. Only literal true enables clipboard replacement.
export function authCodeAutoCopyEnabled(value) {
  return value === true || value?.[AUTH_CODE_AUTO_COPY_KEY] === true;
}

export async function readAuthCodeAutoCopy() {
  const store = globalThis.chrome?.storage?.local;
  if (!store?.get) return false;
  const result = await store.get(AUTH_CODE_AUTO_COPY_KEY);
  return authCodeAutoCopyEnabled(result?.[AUTH_CODE_AUTO_COPY_KEY]);
}
