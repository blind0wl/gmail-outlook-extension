// One queue orders token writes, sign-out markers, and removals.
const epochs = new Map();
let tail = Promise.resolve();
export function capture(key) {
  const provider = key.split(":")[0];
  return `${epochs.get(provider) ?? 0}/${epochs.get(key) ?? 0}`;
}
export function assertCurrent(key, generation) {
  if (capture(key) !== generation)
    throw new Error("auth superseded by sign out");
}
export function invalidate(key) {
  epochs.set(key, (epochs.get(key) ?? 0) + 1);
}
export function sessionOp(op) {
  const run = tail.then(op, op);
  tail = run.catch(() => {});
  return run;
}
const marker = (key) => `signedOut:${key}`;
export async function checkSignedOut(key, interactive) {
  if (interactive) return;
  const store = globalThis.chrome?.storage?.local;
  const data = await store?.get(marker(key));
  if (data?.[marker(key)]) throw new Error("auth needs sign in");
}
export async function markSignedOut(key, value) {
  await globalThis.chrome?.storage?.local?.set({ [marker(key)]: value });
}
