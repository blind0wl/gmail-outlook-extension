import test from "node:test";
import assert from "node:assert/strict";
import * as cache from "../src/store/cache.js";
import * as worker from "../src/background/service-worker.js";
import {
  normalizeGmailMessage,
  fetchGmailMessages,
} from "../src/providers/gmail.js";
import { fetchOutlookMessages } from "../src/providers/outlook.js";
import { threadUrl } from "../src/popup/links.js";
const now = Date.now();
let acct = { provider: "gmail", account: "wave@gmail.com" };
const item = (id, a = acct) => ({
  key: `${a.provider}:${encodeURIComponent(a.account)}:${id}`,
  ...a,
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
let sequence = 0;
function setup() {
  acct = { provider: "gmail", account: `wave${sequence++}@gmail.com` };
  cache.pruneCache(Infinity);
  const local = store();
  globalThis.chrome = { storage: { local } };
  return local;
}
const deps = (items, more = {}) => ({
  now,
  getToken: async () => "token",
  fetchers: { gmail: async () => items },
  setBadge: async () => {},
  notify: async () => {},
  playSound: async () => {},
  ...more,
});
test("account identity separates shared ids and links extract only the message id", () => {
  setup();
  const a = normalizeGmailMessage({ id: "same" }, "a@gmail.com");
  const b = normalizeGmailMessage({ id: "same" }, "b@gmail.com");
  cache.mergeMessages([a, b]);
  assert.equal(cache.getInbox().length, 2);
  assert.match(threadUrl(a), /#inbox\/same$/);
});
test("cache local read survives, cap is 200, newest first, expiry boundary is inclusive", () => {
  setup();
  const rows = Array.from({ length: 201 }, (_, i) => ({
    ...item(String(i)),
    date: now - i,
  }));
  cache.mergeMessages(rows);
  cache.setLocalRead(rows[0].key);
  cache.mergeMessages([rows[0]]);
  assert.equal(cache.getInbox().length, 200);
  assert.equal(cache.getInbox()[0].localRead, true);
  assert.deepEqual(
    cache.getInbox().map((x) => x.date),
    rows.slice(0, 200).map((x) => x.date),
  );
  cache.pruneCache(now + 7 * 86400000);
  assert.equal(cache.getInbox().length, 1);
  cache.pruneCache(now + 7 * 86400000 + 1);
  assert.equal(cache.getInbox().length, 0);
});
test("worker mark-read persists across next poll and updates badge immediately", async () => {
  const local = setup();
  await worker.pollAll([acct], deps([item("read")]));
  let badge;
  await worker.handleMarkRead(item("read").key, [acct], {
    setBadge: async (n) => (badge = n),
  });
  assert.equal(badge, 0);
  await worker.pollAll([acct], deps([item("read")]));
  assert.equal(local.data.mailCache[0].localRead, true);
});
test("first population, muted accounts and server-read messages never toast", async () => {
  setup();
  let toasts = 0;
  const d = (more) => deps(more, { notify: async () => toasts++ });
  await worker.pollAll([acct], d([item("baseline")]));
  assert.equal(toasts, 0);
  await worker.pollAll([{ ...acct, notify: false }], d([item("muted")]));
  await worker.pollAll([acct], d([{ ...item("server-read"), unread: false }]));
  assert.equal(toasts, 0);
});
test("overlapping polls emit one toast after baseline", async () => {
  setup();
  let toasts = 0;
  await worker.pollAll([acct], deps([]));
  await Promise.all([
    worker.pollAll(
      [acct],
      deps([item("new")], { notify: async () => toasts++ }),
    ),
    worker.pollAll(
      [acct],
      deps([item("new")], { notify: async () => toasts++ }),
    ),
  ]);
  assert.equal(toasts, 1);
});
test("complete empty snapshot removes messages; partial and failures preserve them", async () => {
  setup();
  await worker.pollAll([acct], deps([item("stale")]));
  const partial = [];
  partial.complete = false;
  await worker.pollAll([acct], deps(partial));
  assert.equal(cache.getInbox().length, 1);
  await worker.pollAll(
    [acct],
    deps([], {
      fetchers: {
        gmail: async () => {
          throw new Error("offline");
        },
      },
    }),
  );
  assert.equal(cache.getInbox().length, 1);
  await worker.pollAll([acct], deps([]));
  assert.equal(cache.getInbox().length, 0);
});
test("persisted future backoff skips token and mailbox fetch after wake", async () => {
  const local = setup();
  local.data.accountState = {
    "gmail:restart@gmail.com": {
      backedOff: true,
      retryAt: now + 60000,
      failures: 3,
    },
  };
  await worker.hydrateAccountState();
  let calls = 0;
  await worker.pollAll(
    [{ ...acct, account: "restart@gmail.com" }],
    deps([], {
      getToken: async () => {
        calls++;
        return "t";
      },
    }),
  );
  assert.equal(calls, 0);
  assert.equal(local.data.accountState["gmail:restart@gmail.com"].failures, 3);
});
test("auth-stage 503 persists retry deadline", async () => {
  const local = setup();
  await worker.pollAll(
    [{ ...acct, account: "503@gmail.com" }],
    deps([], {
      getToken: async () => {
        throw Object.assign(new Error("secret"), {
          status: 503,
          transient: true,
        });
      },
    }),
  );
  assert.equal(
    local.data.accountState["gmail:503@gmail.com"].retryAt,
    now + 30000,
  );
});
test("large Gmail mailbox has bounded requests across capped slots", async () => {
  let calls = 0;
  const recent = new Date(now - 3600000).toISOString();
  const entry = (i) => `<entry><title>s${i}</title><summary>p</summary><link rel="alternate" href="https://mail.google.com/mail/u/0/#inbox/${i.toString(16).padStart(8, "a")}"/><issued>${recent}</issued><author><name>a</name><email>a@x.y</email></author></entry>`;
  const feed = (account, n) =>
    `<?xml version="1.0"?><feed xmlns="http://purl.org/atom/ns#"><title>Gmail - Inbox for ${account}</title><fullcount>${n}</fullcount>${Array.from({ length: n }, (_, i) => entry(`id${i}`)).join("")}</feed>`;
  globalThis.fetch = async () => {
    calls++;
    if (calls > 20) throw new Error("unbounded");
    return { ok: true, status: 200, text: async () => feed(acct.account, 50) };
  };
  const rows = await fetchGmailMessages("t", now - 86400000);
  assert.ok(calls <= 11, `slot probes capped, saw ${calls}`);
  assert.equal(rows.complete, true);
  assert.ok(rows.length > 0);
});
test("large Outlook mailbox has bounded requests and reports partial snapshot", async () => {
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    if (calls > 20) throw new Error("unbounded");
    return {
      ok: true,
      json: async () =>
        String(url).includes("/me?")
          ? { mail: "a@outlook.com" }
          : {
              value: [{ id: String(calls) }],
              "@odata.nextLink":
                "https://graph.microsoft.com/v1.0/me/messages?next=1",
            },
    };
  };
  const rows = await fetchOutlookMessages("t", now - 86400000);
  assert.ok(calls <= 5);
  assert.equal(rows.complete, false);
});
test("lifecycle messages add, sign out, refresh without revival and remove one account", async () => {
  const local = setup();
  const session = store();
  globalThis.chrome.storage.session = session;
  const options = { interactiveGet: async () => "t", ...deps([]) };
  const target = { ...acct, clientId: "web-client" };
  assert.equal(
    (await worker.handleMessage({ type: "add-account", ...target }, options))
      .ok,
    true,
  );
  assert.equal(local.data.accounts.length, 1);
  assert.equal(
    (await worker.handleMessage({ type: "sign-out", ...target }, options)).ok,
    true,
  );
  let calls = 0;
  await worker.handleMessage(
    { type: "refresh" },
    {
      ...options,
      getToken: async () => {
        calls++;
        return "t";
      },
    },
  );
  assert.equal(calls, 0);
  assert.equal(
    (await worker.handleMessage({ type: "remove-account", ...target }, options))
      .ok,
    true,
  );
  assert.equal(local.data.accounts.length, 0);
});
test("focused provider suppresses toast and sound when enabled, but commits cache and badge", async () => {
  const local = setup();
  local.data.skipFocusedProvider = true;
  let toast = 0,
    sound = 0,
    badge = 0;
  await worker.pollAll([acct], deps([]));
  await worker.pollAll(
    [acct],
    deps([item("focused")], {
      focusedProvider: async () => "gmail",
      notify: async () => toast++,
      playSound: async () => sound++,
      setBadge: async (n) => (badge = n),
    }),
  );
  assert.equal(toast, 0);
  assert.equal(sound, 0);
  assert.equal(badge, 1);
  assert.equal(cache.getInbox().length, 1);
});
test("fast account commits before a slow account finishes", async () => {
  const local = setup();
  const slow = { provider: "outlook", account: "slow@outlook.com" };
  let finish, started;
  const gate = new Promise((r) => (finish = r)),
    seen = new Promise((r) => (started = r));
  const original = local.set.bind(local);
  local.set = async (v) => {
    await original(v);
    if (v.mailCache?.some((i) => i.account === acct.account)) started();
  };
  const pending = worker.pollAll(
    [acct, slow],
    deps([item("fast")], {
      fetchers: {
        gmail: async () => [item("fast")],
        outlook: async () => {
          await gate;
          return [];
        },
      },
    }),
  );
  await seen;
  assert.equal(local.data.mailCache[0].account, acct.account);
  finish();
  await pending;
});
test("focused-tab production lookup suppresses only an active window on the matching provider", async () => {
  const local = setup();
  local.data.skipFocusedProvider = true;
  await worker.pollAll([acct], deps([]));
  let toasts = 0;
  globalThis.chrome.windows = {
    getLastFocused: async () => ({ id: 7, focused: true }),
  };
  globalThis.chrome.tabs = {
    query: async (query) => {
      assert.deepEqual(query, { active: true, windowId: 7 });
      return [{ url: "https://mail.google.com/mail/u/0/" }];
    },
  };
  await worker.pollAll(
    [acct],
    deps([item("tab1")], { notify: async () => toasts++ }),
  );
  assert.equal(toasts, 0);
  globalThis.chrome.windows.getLastFocused = async () => ({
    id: 7,
    focused: false,
  });
  await worker.pollAll(
    [acct],
    deps([item("tab2")], { notify: async () => toasts++ }),
  );
  assert.equal(toasts, 1);
});
test("hydration migrates legacy keys without losing local read", async () => {
  const local = setup();
  local.data.mailCache = [
    { ...item("legacy"), key: "gmail:legacy", localRead: true },
  ];
  const { hydrateCache } = await import("../src/notify/notify.js");
  await hydrateCache();
  await worker.pollAll([acct], deps([item("legacy")]));
  assert.equal(cache.getInbox()[0].localRead, true);
});
test("empty successful first snapshot baseline persists through worker restart", async () => {
  const local = setup();
  await worker.pollAll([acct], deps([]));
  assert.equal(local.data.accountState[`gmail:${acct.account}`].baseline, true);
  const fresh = await import(
    `../src/background/service-worker.js?baseline=${Date.now()}`
  );
  await fresh.ready;
  let toasts = 0;
  await fresh.pollAll(
    [acct],
    deps([item("after-restart")], { notify: async () => toasts++ }),
  );
  assert.equal(toasts, 1);
});
test("cache cap cannot make previously seen account mail notify on every poll", async () => {
  setup();
  const accounts = ["one", "two", "three"].map((n) => ({
    provider: "gmail",
    account: `${n}@gmail.com`,
  }));
  let toasts = 0;
  const d = {
    ...deps([]),
    getToken: async (a) => a.account,
    fetchers: {
      gmail: async (token) =>
        Array.from({ length: 100 }, (_, i) =>
          item(String(i), { provider: "gmail", account: token }),
        ),
    },
    notify: async () => toasts++,
  };
  await worker.pollAll(accounts, d);
  await worker.pollAll([accounts[0]], {
    ...d,
    fetchers: { gmail: async () => [] },
  });
  await worker.pollAll([accounts[2]], d);
  assert.equal(toasts, 0);
});
test("focused-provider suppression is opt-in: default alerts even when focused", async () => {
  setup();
  let toasts = 0;
  await worker.pollAll([acct], deps([]));
  await worker.pollAll(
    [acct],
    deps([item("allowed")], {
      focusedProvider: async () => "gmail",
      notify: async () => toasts++,
    }),
  );
  assert.equal(toasts, 1);
});
test("interactive auth 429 records backoff before the next automatic poll", async () => {
  const local = setup();
  const a = { ...acct, account: "interactive429@gmail.com" };
  await worker.handleSignIn([a], a, {
    interactiveGet: async () => {
      throw Object.assign(new Error("hidden"), {
        status: 429,
        transient: true,
      });
    },
    now,
  });
  assert.equal(
    local.data.accountState["gmail:interactive429@gmail.com"].retryAt,
    now + 30000,
  );
});
test("removing an account during a poll cannot restore its cache or account state", async () => {
  const local = setup();
  globalThis.chrome.storage.session = store();
  local.data.accounts = [acct];
  let finish, started;
  const gate = new Promise((r) => (finish = r)),
    entered = new Promise((r) => (started = r));
  const pending = worker.pollAll(
    [acct],
    deps([], {
      fetchers: {
        gmail: async () => {
          started();
          await gate;
          return [item("removed")];
        },
      },
    }),
  );
  await entered;
  await worker.handleMessage(
    { type: "remove-account", ...acct },
    { setBadge: async () => {} },
  );
  finish();
  await pending;
  assert.equal(local.data.accounts.length, 0);
  assert.equal(local.data.mailCache.length, 0);
  assert.equal(local.data.accountState[`gmail:${acct.account}`], undefined);
});
test("request signals enforce timeouts and both adapters scope to recent mail", async () => {
  let gmailHost, gmailCreds, graphQuery;
  globalThis.fetch = async (url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    const u = new URL(url);
    if (u.hostname === "mail.google.com") {
      gmailHost = u.hostname;
      gmailCreds = options.credentials;
      assert.equal(options.headers?.Authorization, undefined, "no bearer on feed");
      return { ok: false, status: 404, text: async () => "" };
    }
    if (u.pathname === "/v1.0/me")
      return { ok: true, json: async () => ({ mail: "a@outlook.com" }) };
    graphQuery = u;
    return { ok: true, json: async () => ({ value: [] }) };
  };
  await fetchGmailMessages("t", now - 86400000);
  await fetchOutlookMessages("t", now - 86400000);
  assert.equal(gmailHost, "mail.google.com");
  assert.equal(gmailCreds, "include", "session cookie authenticates");
  assert.equal(graphQuery.pathname, "/v1.0/me/mailFolders/inbox/messages");
  assert.match(graphQuery.searchParams.get("$filter"), /^receivedDateTime ge /);
});

test("focus suppression uses focus at notification time, after the network finishes", async () => {
  const local = setup();
  local.data.skipFocusedProvider = true;
  await worker.pollAll([acct], deps([]));
  let focused = null;
  let toasts = 0;
  await worker.pollAll(
    [acct],
    deps([], {
      focusedProvider: async () => focused,
      fetchers: {
        gmail: async () => {
          focused = "gmail";
          return [item("focus-changed")];
        },
      },
      notify: async () => toasts++,
    }),
  );
  assert.equal(toasts, 0);
});
