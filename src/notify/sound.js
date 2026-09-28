// Sound settings plus the offscreen chime bridge.
// Pure logic (shouldPlay, volume clamp, mute checks) lives here so it is
// testable under Node. The chrome.* calls are isolated in
// get/set helpers and playChime and degrade to safe no-ops where chrome
// does not exist (Node tests stub globalThis.chrome with an in-memory
// double instead).
//
// Service workers cannot play audio, so playChime forwards to the
// offscreen document (src/notify/offscreen.html), which owns the only
// AudioContext in the extension. No mail content ever enters this path:
// playChime carries at most a volume level, never subjects or snippets.

// chrome.storage.local key. Both the worker and the popup read and write
// this same shape: { masterMuted, volume, mutedAccounts }.
export const SOUND_SETTINGS_KEY = "soundSettings";

export const DEFAULT_SOUND_SETTINGS = {
  masterMuted: false,
  volume: 0.5,
  mutedAccounts: {},
};

// Offscreen document path, relative to the extension root (matches
// manifest.json background.service_worker layout).
export const OFFSCREEN_DOCUMENT_PATH = "src/notify/offscreen.html";

// Message type the offscreen document listens for. Volume-only payload.
export const PLAY_CHIME_MESSAGE = "play-chime";

// True only for an automatic poll with new mail and nothing silencing it.
// manual: refresh triggered by the user (Task 5 never chimes there).
// muted: master switch or every new-mail account muted per account.
// dnd: OS do-not-disturb, where reported (no stable MV3 API, so callers
// pass through whatever signal they have; default is undisturbed=false).
export function shouldPlay({ manual, muted, dnd } = {}) {
  if (manual) return false;
  if (muted) return false;
  if (dnd) return false;
  return true;
}

// Clamp to 0..1. Non-numeric input falls back to the default volume.
export function clampVolume(level) {
  if (typeof level !== "number" || Number.isNaN(level)) {
    return DEFAULT_SOUND_SETTINGS.volume;
  }
  return Math.min(1, Math.max(0, level));
}

// Master switch wins; otherwise muted only when every listed account key
// ("provider:address") is muted. An empty key list falls back to the
// master switch alone.
export function isMuted(settings, accountKeys = []) {
  if (settings?.masterMuted) return true;
  const map = settings?.mutedAccounts ?? {};
  if (!accountKeys.length) return false;
  return accountKeys.every((k) => map[k] === true);
}

function storageLocal() {
  return globalThis.chrome?.storage?.local;
}

function withDefaults(stored) {
  return {
    masterMuted: stored?.masterMuted ?? DEFAULT_SOUND_SETTINGS.masterMuted,
    volume: clampVolume(stored?.volume ?? DEFAULT_SOUND_SETTINGS.volume),
    mutedAccounts: { ...(stored?.mutedAccounts ?? {}) },
  };
}

// Read persisted settings merged over defaults. No-op defaults without chrome.
export async function getSoundSettings() {
  const store = storageLocal();
  if (!store) return withDefaults(undefined);
  const data = await store.get(SOUND_SETTINGS_KEY);
  return withDefaults(data?.[SOUND_SETTINGS_KEY]);
}

async function saveSettings(settings) {
  const store = storageLocal();
  const merged = withDefaults(settings);
  if (!store) return merged;
  await store.set({ [SOUND_SETTINGS_KEY]: merged });
  return merged;
}

// Master mute plus per-account toggles. `all` sets the master switch;
// `perAccount` ({ accountKey: muted }) merges into the stored map so one
// popup toggle cannot clobber the others. Either argument may be omitted
// to leave that half untouched.
export async function setMuted(all, perAccount) {
  const current = await getSoundSettings();
  return saveSettings({
    ...current,
    masterMuted: typeof all === "boolean" ? all : current.masterMuted,
    mutedAccounts:
      perAccount && typeof perAccount === "object"
        ? { ...current.mutedAccounts, ...perAccount }
        : current.mutedAccounts,
  });
}

// Persisted volume in 0..1 (clamped). Readable by worker and popup alike.
export async function setVolume(level) {
  const current = await getSoundSettings();
  return saveSettings({ ...current, volume: clampVolume(level) });
}

// Union of configured accounts and cached-mail accounts for the popup's
// per-account chime toggles, deduplicated on "provider:account". A
// configured account with no cached messages still gets a control, so its
// toggle never vanishes with its messages. Keys match isMuted/worker keys.
export function soundControlKeys(configured, cached) {
  const seen = new Set();
  const keys = [];
  const push = (provider, account) => {
    const key = `${provider}:${account || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    keys.push({ key, label: `${account || ""} (${provider})` });
  };
  for (const a of configured ?? []) push(a.provider, a.account);
  for (const i of cached ?? []) push(i.provider, i.account);
  return keys;
}

async function ensureOffscreenDocument() {
  const offscreen = globalThis.chrome?.offscreen;
  // No offscreen API (older Chrome, tests): still try sendMessage; the
  // catch in playChime keeps polling safe.
  if (!offscreen) return false;
  try {
    if (await offscreen.hasDocument?.()) return true;
    await offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play a short chime when automatic polls find new mail.",
    });
    return true;
  } catch {
    return false;
  }
}

// Ask the offscreen document to play one short chime. Carries only the
// volume level, never mail content. Resolves true when the request was
// handed off, false when sound is unavailable (Node, missing APIs) —
// never throws, so polling can await it unconditionally.
export async function playChime(volume) {
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.sendMessage) return false;
  let level = volume;
  if (level === undefined) {
    try {
      level = (await getSoundSettings()).volume;
    } catch {
      level = DEFAULT_SOUND_SETTINGS.volume;
    }
  }
  try {
    await ensureOffscreenDocument();
    await runtime.sendMessage({ type: PLAY_CHIME_MESSAGE, volume: clampVolume(level) });
    return true;
  } catch {
    return false;
  }
}
