// Authentication codes and notification routing stay in storage.session:
// they survive service-worker sleep and clear with the browser session.

export const PENDING_AUTH_CODES_KEY = "pendingAuthCodes";
export const AUTH_CODE_NOTIFICATIONS_KEY = "authCodeNotifications";
export const AUTH_CODE_PROCESSED_KEY = "processedAuthCodes";

const memory = new Map();
let sessionTail = Promise.resolve();

function sessionStore() {
  return globalThis.chrome?.storage?.session;
}

async function read(key) {
  const store = sessionStore();
  if (!store?.get) return memory.get(key) ?? {};
  const data = await store.get(key);
  const value = data?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function write(key, value) {
  const store = sessionStore();
  if (!store?.set) {
    memory.set(key, value);
    return Promise.resolve();
  }
  return store.set({ [key]: value });
}

function serialized(op) {
  const run = sessionTail.then(op, op);
  sessionTail = run.catch(() => {});
  return run;
}

function prune(map, now) {
  for (const [key, value] of Object.entries(map)) {
    if (!value || value.expiresAt <= now) delete map[key];
  }
}

// Saves code and dedupe marker together. The map contains no email body,
// subject, address, or provider credential.
export function savePendingAuthCode(key, code, expiresAt, now = Date.now(), version = key) {
  return serialized(async () => {
    const [codes, processed] = await Promise.all([
      read(PENDING_AUTH_CODES_KEY),
      read(AUTH_CODE_PROCESSED_KEY),
    ]);
    prune(codes, now);
    prune(processed, now);
    const versionKey = `${key}#${String(version)}`;
    if (processed[versionKey]?.code === String(code)) return false;
    codes[key] = { code: String(code), expiresAt, version: String(version) };
    processed[versionKey] = { expiresAt, code: String(code) };
    await Promise.all([
      write(PENDING_AUTH_CODES_KEY, codes),
      write(AUTH_CODE_PROCESSED_KEY, processed),
    ]);
    return true;
  });
}

export async function getPendingAuthCode(key, now = Date.now()) {
  return serialized(async () => {
    const [codes, processed] = await Promise.all([
      read(PENDING_AUTH_CODES_KEY),
      read(AUTH_CODE_PROCESSED_KEY),
    ]);
    prune(codes, now);
    prune(processed, now);
    const record = codes[key];
    await Promise.all([
      write(PENDING_AUTH_CODES_KEY, codes),
      write(AUTH_CODE_PROCESSED_KEY, processed),
    ]);
    return record ?? null;
  });
}

export function mapNotificationToMessage(notificationId, key, expiresAt) {
  return serialized(async () => {
    const notifications = await read(AUTH_CODE_NOTIFICATIONS_KEY);
    prune(notifications, Date.now());
    notifications[notificationId] = { key, expiresAt };
    await write(AUTH_CODE_NOTIFICATIONS_KEY, notifications);
  });
}

export async function messageForNotification(notificationId, now = Date.now()) {
  return serialized(async () => {
    const notifications = await read(AUTH_CODE_NOTIFICATIONS_KEY);
    prune(notifications, now);
    const record = notifications[notificationId];
    await write(AUTH_CODE_NOTIFICATIONS_KEY, notifications);
    return record?.key ?? null;
  });
}

export function removeNotificationMapping(notificationId) {
  return serialized(async () => {
    const notifications = await read(AUTH_CODE_NOTIFICATIONS_KEY);
    delete notifications[notificationId];
    await write(AUTH_CODE_NOTIFICATIONS_KEY, notifications);
  });
}

export function clearAuthCodeRecords(keys) {
  const targets = new Set(keys ?? []);
  return serialized(async () => {
    const [codes, processed, notifications] = await Promise.all([
      read(PENDING_AUTH_CODES_KEY),
      read(AUTH_CODE_PROCESSED_KEY),
      read(AUTH_CODE_NOTIFICATIONS_KEY),
    ]);
    for (const key of targets) {
      delete codes[key];
      for (const versionKey of Object.keys(processed))
        if (versionKey.startsWith(`${key}#`)) delete processed[versionKey];
    }
    const removedNotifications = [];
    for (const [id, record] of Object.entries(notifications)) {
      if (targets.has(record?.key)) {
        removedNotifications.push(id);
        delete notifications[id];
      }
    }
    await Promise.all([
      write(PENDING_AUTH_CODES_KEY, codes),
      write(AUTH_CODE_PROCESSED_KEY, processed),
      write(AUTH_CODE_NOTIFICATIONS_KEY, notifications),
    ]);
    return removedNotifications;
  });
}

// Test helper. Also useful when the extension environment lacks storage.session.
export function clearMemoryAuthCodeSession() {
  memory.clear();
}
