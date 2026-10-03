// One local preference; provider credentials and mailbox state are untouched.
export const THEME_KEY = "popupTheme";
export const DEFAULT_THEME = "midnight";
export const THEMES = ["midnight", "slate", "signal"];
export function validTheme(value) {
  return THEMES.includes(value) ? value : DEFAULT_THEME;
}
export async function loadTheme(store = globalThis.chrome?.storage?.local) {
  const data = await store?.get(THEME_KEY);
  return validTheme(data?.[THEME_KEY]);
}
let writes = Promise.resolve();
export function saveTheme(value, store = globalThis.chrome?.storage?.local) {
  if (!THEMES.includes(value)) return Promise.reject(new Error("Unknown popup theme"));
  const result = writes.then(() => store?.set({ [THEME_KEY]: value }));
  writes = result.catch(() => {});
  return result;
}
