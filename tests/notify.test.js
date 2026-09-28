import test from "node:test";
import assert from "node:assert";
import { diffNewIds, unreadCount } from "../src/notify/notify.js";
test("diff finds new and count ignores local read", () => {
  assert.deepEqual(diffNewIds(["a"], ["a", "b"]), ["b"]);
  assert.equal(unreadCount([{ unread: true, localRead: true }, { unread: true }]), 1);
});

import {
  groupByAccount,
  buildToast,
  sanitizeError,
  persistCache,
  hydrateCache,
  CACHE_KEY,
  ACCOUNT_STATE_KEY,
} from "../src/notify/notify.js";
import { getInbox, mergeMessages, setLocalRead, pruneCache } from "../src/store/cache.js";
import {
  pollAccount,
  pollAll,
  handleAlarm,
  needsSignInFor,
  clearNeedsSignIn,
  hydrateAccountState,
  sendNotification,
  clampInterval,
  MIN_POLL_MS,
  MAX_POLL_MS,
  DEFAULT_POLL_MS,
} from "../src/background/service-worker.js";

// Minimal in-memory storage.local double. Kept inside this test file:
// chrome.* does not exist under Node.
function installChromeStub() {
  const data = {};
  globalThis.chrome = {
    storage: {
      local: {
        set: async (obj) => void Object.assign(data, obj),
        get: async (key) => ({ [key]: data[key] }),
      },
    },
  };
  return data;
}

function uninstallChromeStub() {
  delete globalThis.chrome;
}

const item = (key, provider, account, subject = "s") => ({
  key,
  provider,
  account,
  from: "f",
  subject,
  snippet: "p",
  date: Date.now(),
  unread: true,
});

test("groupByAccount groups per account; buildToast shapes one toast", () => {
  const groups = groupByAccount([
    item("gmail:1", "gmail", "a@g.c", "hello"),
    item("gmail:2", "gmail", "a@g.c", "world"),
    item("outlook:3", "outlook", "b@o.c", "solo"),
  ]);
  assert.equal(groups.length, 2);
  const toast = buildToast(groups[0]);
  assert.match(toast.title, /a@g\.c/);
  assert.match(toast.message, /2 new messages/);
  assert.equal(buildToast(groups[1]).message, "solo");
});

test("persist plus hydrate round-trips the merged cache", async () => {
  const backing = installChromeStub();
  try {
    await persistCache([item("gmail:p1", "gmail", "persist@g.c")]);
    assert.equal(backing[CACHE_KEY].length, 1);
    const inbox = await hydrateCache();
    assert.ok(inbox.find((i) => i.key === "gmail:p1"));
  } finally {
    uninstallChromeStub();
  }
});

test("hydrate is a no-op without chrome", async () => {
  uninstallChromeStub();
  assert.deepEqual(await hydrateCache(), []);
});

test("clampInterval enforces 30s to 5h range with 1 minute default", () => {
  assert.equal(clampInterval(undefined), DEFAULT_POLL_MS);
  assert.equal(clampInterval(1000), MIN_POLL_MS);
  assert.equal(clampInterval(9 * 3600 * 1000), MAX_POLL_MS);
});

test("401 refreshes once then retries; second 401 sets needs sign in", async () => {
  const acct = { provider: "gmail", account: "auth@g.c" };
  let calls = 0;
  const fetchers = {
    gmail: async () => {
      calls += 1;
      const err = new Error("unauthorized");
      err.status = 401;
      throw err;
    },
  };
  let refreshes = 0;
  const r = await pollAccount(acct, {
    fetchers,
    getToken: async () => "old",
    refreshToken: async () => {
      refreshes += 1;
      return "fresh";
    },
  });
  assert.equal(r.needsSignIn, true);
  assert.equal(refreshes, 1, "exactly one silent refresh");
  assert.equal(calls, 2, "one try plus one retry");
});

test("401 then success after refresh clears and returns items", async () => {
  const acct = { provider: "gmail", account: "refresh-ok@g.c" };
  let calls = 0;
  const fetchers = {
    gmail: async () => {
      calls += 1;
      if (calls === 1) {
        const err = new Error("unauthorized");
        err.status = 401;
        throw err;
      }
      return [item("gmail:rok", "gmail", "refresh-ok@g.c")];
    },
  };
  const r = await pollAccount(acct, {
    fetchers,
    getToken: async () => "old",
    refreshToken: async () => "fresh",
  });
  assert.deepEqual(r.items.map((i) => i.key), ["gmail:rok"]);
});

test("429 backs off and keeps the stale cache visible", async () => {
  const acct = { provider: "outlook", account: "slow@o.c" };
  const err429 = () => {
    const e = new Error("rate limited");
    e.status = 429;
    return e;
  };
  const fetchers = { outlook: async () => { throw err429(); } };
  const deps = { fetchers, getToken: async () => "t", now: Date.now() };
  const first = await pollAccount(acct, deps);
  assert.equal(first.backedOff, true);
  // Immediate second poll is skipped by backoff, fetcher not hit again.
  let hits = 0;
  const counting = { outlook: async () => { hits += 1; return []; } };
  const second = await pollAccount(acct, { ...deps, fetchers: counting });
  assert.equal(second.backedOff, true);
  assert.equal(hits, 0);
});

test("one failed account never blocks the others", async () => {
  installChromeStub();
  try {
    const ok = { provider: "gmail", account: "ok1@g.c" };
    const bad = { provider: "outlook", account: "bad@o.c" };
    const boom = new Error("down");
    boom.status = 500;
    const fetchers = {
      gmail: async () => [item("gmail:iso", "gmail", "ok1@g.c")],
      outlook: async () => { throw boom; },
    };
    const toasts = [];
    const summary = await pollAll([ok, bad], {
      fetchers,
      getToken: async () => "t",
      notify: async (group, toast) => void toasts.push([group, toast]),
      setBadge: async () => {},
    });
    assert.ok(summary.succeeded.includes("gmail:ok1@g.c"));
    assert.ok(getInbox().find((i) => i.key === "gmail:iso"));
    assert.equal(toasts.length, 1, "one grouped toast for the working account");
  } finally {
    uninstallChromeStub();
  }
});

test("manual refresh updates badge but sends no toast", async () => {
  installChromeStub();
  try {
    const acct = { provider: "gmail", account: "manual@g.c" };
    const fetchers = { gmail: async () => [item("gmail:man", "gmail", "manual@g.c")] };
    let badge = -1;
    const toasts = [];
    const summary = await pollAll([acct], {
      fetchers,
      getToken: async () => "t",
      manual: true,
      notify: async (group, toast) => void toasts.push([group, toast]),
      setBadge: async (n) => void (badge = n),
    });
    assert.ok(summary.newIds.includes("gmail:man"));
    assert.equal(toasts.length, 0);
    assert.equal(badge, 1, "badge is the exact unread total for the polled account");
  } finally {
    uninstallChromeStub();
  }
});

test("zero item poll keeps the stale cache", async () => {
  installChromeStub();
  try {
    const acct = { provider: "gmail", account: "stale@g.c" };
    const before = getInbox().length;
    const summary = await pollAll([acct], {
      fetchers: { gmail: async () => [] },
      getToken: async () => "t",
      notify: async () => {},
      setBadge: async () => {},
    });
    assert.deepEqual(summary.newIds, []);
    assert.ok(getInbox().length >= before);
  } finally {
    uninstallChromeStub();
  }
});

test("badge is the exact total across enabled accounts only", async () => {
  installChromeStub();
  try {
    // Disabled account with unread mail plus a locally-read item: neither counts.
    mergeMessages([
      item("gmail:boff1", "gmail", "off@x.c"),
      item("gmail:boff2", "gmail", "off@x.c"),
      item("gmail:bread", "gmail", "badge-a@x.c"),
    ]);
    setLocalRead("gmail:bread");
    const a = { provider: "gmail", account: "badge-a@x.c" };
    const b = { provider: "outlook", account: "badge-b@x.c" };
    const c = { provider: "gmail", account: "off@x.c", enabled: false };
    const fetchers = {
      gmail: async () => [
        item("gmail:ba1", "gmail", "badge-a@x.c"),
        item("gmail:ba2", "gmail", "badge-a@x.c"),
      ],
      outlook: async () => [item("outlook:bb1", "outlook", "badge-b@x.c")],
    };
    let badge = -1;
    await pollAll([a, b, c], {
      fetchers,
      getToken: async () => "t",
      manual: true,
      notify: async () => {},
      setBadge: async (n) => void (badge = n),
    });
    assert.equal(badge, 3, "ba1 plus ba2 plus bb1; bread read locally, off@x.c disabled");
  } finally {
    uninstallChromeStub();
  }
});

for (const status of [429, 500]) {
  test(`401 then ${status} retry backs off instead of flagging sign-in`, async () => {
    const acct = { provider: "gmail", account: `flaky-${status}@g.c` };
    let calls = 0;
    const fetchers = {
      gmail: async () => {
        calls += 1;
        const err = new Error(calls === 1 ? "unauthorized" : "transient");
        err.status = calls === 1 ? 401 : status;
        throw err;
      },
    };
    const r = await pollAccount(acct, {
      fetchers,
      getToken: async () => "old",
      refreshToken: async () => "fresh",
      now: Date.now(),
    });
    assert.equal(r.backedOff, true);
    assert.equal(r.needsSignIn, undefined);
    assert.equal(needsSignInFor(acct), false, "flag reserved for auth failures");
  });
}

test("sign-in flag survives restart and clears on recovery", async () => {
  const backing = installChromeStub();
  try {
    const acct = { provider: "gmail", account: "flag@g.c" };
    const err401 = () => {
      const e = new Error("unauthorized");
      e.status = 401;
      throw e;
    };
    const quiet = { notify: async () => {}, setBadge: async () => {} };
    await pollAll([acct], {
      fetchers: { gmail: async () => err401() },
      getToken: async () => "old",
      refreshToken: async () => "fresh",
      ...quiet,
    });
    assert.equal(needsSignInFor(acct), true);
    assert.equal(backing[ACCOUNT_STATE_KEY]?.["gmail:flag@g.c"]?.needsSignIn, true);
    // Simulate a worker restart: memory flags are gone, storage remains.
    clearNeedsSignIn(acct);
    assert.equal(needsSignInFor(acct), false);
    await hydrateAccountState();
    assert.equal(needsSignInFor(acct), true, "flag restored from storage");
    // Authenticated success clears the flag in memory and in storage.
    await pollAll([acct], {
      fetchers: { gmail: async () => [item("gmail:flagok", "gmail", "flag@g.c")] },
      getToken: async () => "t",
      ...quiet,
    });
    assert.equal(needsSignInFor(acct), false);
    assert.equal(backing[ACCOUNT_STATE_KEY]?.["gmail:flag@g.c"]?.needsSignIn, false);
  } finally {
    uninstallChromeStub();
  }
});

test("raw exceptions are sanitized before reaching results", async () => {
  installChromeStub();
  try {
    const acct = { provider: "gmail", account: "leak@g.c" };
    const secret = "SECRET-salary-200k-diabetes";
    const fetchers = {
      gmail: async () => {
        throw new Error(`inbox dump subject snippet ${secret}`);
      },
    };
    const r = await pollAccount(acct, { fetchers, getToken: async () => "t" });
    assert.ok(!JSON.stringify(r).includes(secret), "no mail content in result");
    assert.ok(r.error.at, "sanitized error carries a timestamp");
    assert.equal(r.error.status, undefined);
    const seen = [];
    await pollAll([acct], {
      fetchers,
      getToken: async () => "t",
      notify: async () => {},
      setBadge: async () => {},
      onError: (f) => void seen.push(f),
    });
    assert.equal(seen.length, 1);
    assert.ok(!JSON.stringify(seen[0]).includes(secret), "no mail content in onError");
    assert.equal(sanitizeError(r.error).name, "PollError");
  } finally {
    uninstallChromeStub();
  }
});

test("notification options include the packaged icon", async () => {
  let captured;
  globalThis.chrome = {
    notifications: {
      create: async (id, opts) => {
        captured = opts;
        return id;
      },
    },
    storage: { local: { set: async () => {}, get: async () => ({}) } },
  };
  try {
    await sendNotification(
      { provider: "gmail", account: "icon@g.c" },
      { title: "t", message: "m" },
    );
    assert.equal(captured.type, "basic");
    assert.ok(captured.iconUrl?.includes("icon.png"), `iconUrl packaged: ${captured.iconUrl}`);
  } finally {
    uninstallChromeStub();
  }
});

test("fresh worker woken by alarm hydrates before polling", async () => {
  const backing = installChromeStub();
  try {
    // Storage holds mail; pruneCache(Infinity) empties process memory the way
    // a terminated worker loses it. Unique keys isolate this from other tests.
    backing[CACHE_KEY] = [item("gmail:wake1", "gmail", "wake@g.c", "stored mail")];
    pruneCache(Infinity);
    assert.equal(getInbox().length, 0, "memory starts empty like a fresh worker");
    // Fresh module evaluation creates a fresh init promise against the stub.
    const fresh = await import("../src/background/service-worker.js?fresh-wake");
    assert.equal(typeof fresh.ready?.then, "function", "init promise created on evaluation");
    const acct = { provider: "gmail", account: "wake@g.c" };
    const toasts = [];
    // Alarm entry point with no startup events and a zero-item poll.
    const summary = await fresh.handleAlarm([acct], {
      fetchers: { gmail: async () => [] },
      getToken: async () => "t",
      notify: async (group, toast) => void toasts.push(toast),
      setBadge: async () => {},
    });
    assert.ok(
      getInbox().find((i) => i.key === "gmail:wake1"),
      "memory hydrated from storage before polling",
    );
    assert.equal(
      backing[CACHE_KEY]?.find((i) => i.key === "gmail:wake1")?.key,
      "gmail:wake1",
      "empty poll does not overwrite stored mail",
    );
    assert.deepEqual(toasts, [], "stored mail is not toasted as new");
    assert.deepEqual(summary.newIds, []);
  } finally {
    uninstallChromeStub();
  }
});
