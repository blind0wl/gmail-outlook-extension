import test from "node:test";
import assert from "node:assert";
import {
  shouldPlay,
  clampVolume,
  isMuted,
  getSoundSettings,
  setMuted,
  setVolume,
  playChime,
  soundControlKeys,
  SOUND_SETTINGS_KEY,
  DEFAULT_SOUND_SETTINGS,
} from "../src/notify/sound.js";
import { pollAll } from "../src/background/service-worker.js";

// Brief Step 1, verbatim.
test("sound silent on manual refresh, muted account, and DND", () => {
  assert.equal(shouldPlay({ manual: true, muted: false, dnd: false }), false);
  assert.equal(shouldPlay({ manual: false, muted: true, dnd: false }), false);
  assert.equal(shouldPlay({ manual: false, muted: false, dnd: true }), false);
});

test("sound plays on automatic poll with nothing muted", () => {
  assert.equal(shouldPlay({ manual: false, muted: false, dnd: false }), true);
});

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

test("sound settings default without chrome and persist volume plus mute", async () => {
  uninstallChromeStub();
  assert.deepEqual(await getSoundSettings(), DEFAULT_SOUND_SETTINGS);
  assert.equal(await playChime(), false, "no chrome means silent no-op");

  const backing = installChromeStub();
  try {
    await setVolume(0.8);
    assert.equal(backing[SOUND_SETTINGS_KEY].volume, 0.8);
    await setMuted(true, { "gmail:a@g.c": true });
    assert.equal(backing[SOUND_SETTINGS_KEY].masterMuted, true);
    assert.equal(backing[SOUND_SETTINGS_KEY].mutedAccounts["gmail:a@g.c"], true);
    // Volume survives the mute write; mute map merges instead of clobbering.
    assert.equal(backing[SOUND_SETTINGS_KEY].volume, 0.8);
    await setVolume(99);
    assert.equal((await getSoundSettings()).volume, 1, "volume clamps to 0..1");
  } finally {
    uninstallChromeStub();
  }
});

test("isMuted covers master switch and per-account map", async () => {
  uninstallChromeStub();
  const settings = await getSoundSettings();
  assert.equal(isMuted(settings, ["gmail:a@g.c"]), false);
  assert.equal(isMuted({ ...settings, masterMuted: true }, ["gmail:a@g.c"]), true);
  assert.equal(
    isMuted({ ...settings, mutedAccounts: { "gmail:a@g.c": true } }, ["gmail:a@g.c"]),
    true,
  );
  assert.equal(
    isMuted({ ...settings, mutedAccounts: { "gmail:a@g.c": true } }, ["gmail:b@g.c"]),
    false,
  );
  assert.equal(clampVolume("loud"), DEFAULT_SOUND_SETTINGS.volume);
});

test("worker chimes once on automatic new mail, never on manual refresh", async () => {
  const backing = installChromeStub();
  try {
    const acct = { provider: "gmail", account: "chime@g.c" };
    const fetchers = {
      gmail: async () => [
        {
          key: "gmail:chime1",
          provider: "gmail",
          account: "chime@g.c",
          from: "f",
          subject: "s",
          snippet: "p",
          date: Date.now(),
          unread: true,
        },
      ],
    };
    const quiet = { notify: async () => {}, setBadge: async () => {} };
    let chimes = 0;
    await pollAll([acct], {
      fetchers,
      getToken: async () => "t",
      playSound: async () => void chimes++,
      ...quiet,
    });
    assert.equal(chimes, 1, "automatic poll with new mail chimes once");

    chimes = 0;
    await pollAll([acct], {
      fetchers,
      getToken: async () => "t",
      manual: true,
      playSound: async () => void chimes++,
      ...quiet,
    });
    assert.equal(chimes, 0, "manual refresh stays silent");

    // Master mute silences even automatic new mail. Unique key so the
    // first poll's mail is not diffed as new again.
    backing[SOUND_SETTINGS_KEY] = {
      masterMuted: true,
      volume: 0.5,
      mutedAccounts: {},
    };
    const fetchers2 = {
      gmail: async () => [
        {
          key: "gmail:chime2",
          provider: "gmail",
          account: "chime@g.c",
          from: "f",
          subject: "s",
          snippet: "p",
          date: Date.now(),
          unread: true,
        },
      ],
    };
    chimes = 0;
    await pollAll([acct], {
      fetchers: fetchers2,
      getToken: async () => "t",
      playSound: async () => void chimes++,
      ...quiet,
    });
    assert.equal(chimes, 0, "muted stays silent");
  } finally {
    uninstallChromeStub();
  }
});

test("chime controls include a configured account with an empty cache", () => {
  // Configured in storage but zero cached messages: toggle must exist.
  const keys = soundControlKeys(
    [{ provider: "gmail", account: "empty@g.c" }],
    [],
  );
  assert.deepEqual(keys, [{ key: "gmail:empty@g.c", label: "empty@g.c (gmail)" }]);
  // Cached accounts union with configured ones; duplicates collapse.
  const union = soundControlKeys(
    [
      { provider: "gmail", account: "empty@g.c" },
      { provider: "outlook", account: "cfg@o.c" },
    ],
    [{ provider: "gmail", account: "empty@g.c" }],
  );
  assert.deepEqual(
    union.map((k) => k.key),
    ["gmail:empty@g.c", "outlook:cfg@o.c"],
  );
  // Keys stay provider:account so worker mute checks agree with the popup.
  assert.equal(isMuted({ masterMuted: false, mutedAccounts: { "gmail:empty@g.c": true } }, [keys[0].key]), true);
});
