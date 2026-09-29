import test from "node:test";
import assert from "node:assert/strict";
import * as cache from "../src/store/cache.js";
import * as worker from "../src/background/service-worker.js";

// Issue #2: a stale sign-in poll must never delete newer alarm-poll mail
// nor cause it to re-alert. handleSignIn polls via pollAccount directly,
// concurrent with pollAll alarm cycles; its complete reconcile then wipes
// whatever the alarm committed mid-fetch.
const now = Date.now();
let sequence = 0;
const item = (id, acct) => ({
  key: `${acct.provider}:${encodeURIComponent(acct.account)}:${id}`,
  ...acct,
  date: now,
  unread: true,
  subject: "subject",
  snippet: "snippet",
});
function store(seed = {}) {
  return {
    data: structuredClone(seed),
    async get(k) {
      return k === null
        ? structuredClone(this.data)
        : { [k]: structuredClone(this.data[k]) };
    },
    async set(v) {
      Object.assign(this.data, structuredClone(v));
    },
    async remove(k) {
      delete this.data[k];
    },
  };
}
function setup() {
  const acct = { provider: "gmail", account: `race${sequence++}@gmail.com` };
  cache.pruneCache(Infinity);
  globalThis.chrome = { storage: { local: store() } };
  return acct;
}
const base = (more = {}) => ({
  now,
  getToken: async () => "token",
  refreshToken: async () => "token",
  setBadge: async () => {},
  notify: async () => {},
  playSound: async () => {},
  ...more,
});

test("stale sign-in fetch racing an alarm poll keeps newer mail and stays silent", async () => {
  const acct = setup();
  const oldItem = item("old", acct);
  const newItem = item("new", acct);
  let releaseSignInFetch;
  const signInGate = new Promise((r) => (releaseSignInFetch = r));
  let signInFetchStarted;
  const signInStarted = new Promise((r) => (signInFetchStarted = r));
  const signInDeps = base({
    interactiveGet: async () => null,
    fetchers: {
      gmail: async () => {
        signInFetchStarted();
        await signInGate;
        return [oldItem];
      },
    },
  });
  // Sign-in poll starts first but its fetch stalls on the network.
  const signInPromise = worker.handleSignIn([acct], acct, signInDeps);
  await signInStarted;
  // Alarm cycle runs while the sign-in fetch is in flight; the server now
  // has newer mail the stale fetch will never include. The alarm queues
  // behind the in-flight sign-in unit (shared poll chain), so the test
  // must not await it before releasing the gate.
  const alarmDeps = base({ fetchers: { gmail: async () => [oldItem, newItem] } });
  const alarmPromise = worker.pollAll([acct], alarmDeps);
  await new Promise((r) => setImmediate(r));
  releaseSignInFetch();
  const alarmResult = await alarmPromise;
  await signInPromise;
  assert.deepEqual(
    alarmResult.newIds.sort(),
    [newItem.key].sort(),
    "alarm poll commits newer mail after the sign-in unit",
  );
  const keys = new Set(cache.getInbox().map((i) => i.key));
  assert.ok(keys.has(oldItem.key), "old mail survives the stale commit");
  assert.ok(keys.has(newItem.key), "newer alarm mail survives the stale commit");
  // A follow-up poll returning the same server state must stay silent:
  // deleted-then-refetched mail would re-alert here.
  const followUp = await worker.pollAll([acct], alarmDeps);
  assert.deepEqual(followUp.newIds, [], "no re-alert for already-seen mail");
});
