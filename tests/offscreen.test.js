import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/notify/offscreen.js", import.meta.url), "utf8");

// Node has no browser audio device. Capture the player's media boundary while
// running the actual offscreen script and its registered message handler.
function player(play = () => Promise.resolve()) {
  const clips = [];
  let receive;
  vm.runInNewContext(source, {
    Audio: class {
      constructor(url) {
        this.src = url;
        this.currentTime = 0;
        clips.push(this);
      }
      play() {
        return play(this);
      }
    },
    chrome: {
      runtime: {
        getURL: (path) => `chrome-extension://test/${path}`,
        onMessage: { addListener: (listener) => { receive = listener; } },
      },
    },
  });
  return { clips, receive };
}

test("offscreen plays the bundled chime at the requested volume", () => {
  const starts = [];
  const { clips, receive } = player((clip) => {
    starts.push({ src: clip.src, volume: clip.volume, time: clip.currentTime });
    return Promise.resolve();
  });
  receive({ type: "unrelated", volume: 1 });
  assert.equal(clips.length, 0);
  receive({ type: "play-chime", volume: 0.25 });
  assert.deepEqual(starts, [{
    src: "chrome-extension://test/src/notify/sounds/chime.mp3", volume: 0.25, time: 0,
  }]);
  // A second alert restarts the clip and applies the latest volume.
  clips[0].currentTime = 0.4;
  receive({ type: "play-chime", volume: 0.8 });
  assert.equal(starts[1].time, 0);
  assert.equal(starts[1].volume, 0.8);
});

test("offscreen normalizes volume including a completely silent zero", () => {
  const starts = [];
  const { receive } = player((clip) => {
    starts.push(clip.volume);
    return Promise.resolve();
  });
  for (const volume of [0, -1, 2, "loud", undefined, NaN]) {
    receive({ type: "play-chime", volume });
  }
  assert.deepEqual(starts, [0, 0, 1, 0.5, 0.5, 0.5]);
});

test("offscreen contains rejected playback and can play a later alert", async () => {
  let attempts = 0;
  const { receive } = player(() => {
    attempts++;
    return attempts === 1 ? Promise.reject(new Error("Audio unavailable")) : Promise.resolve();
  });
  assert.doesNotThrow(() => receive({ type: "play-chime", volume: 0.5 }));
  await new Promise((resolve) => setImmediate(resolve));
  receive({ type: "play-chime", volume: 0.5 });
  assert.equal(attempts, 2);
});

test("offscreen contains synchronous audio failures", () => {
  let attempts = 0;
  const { receive } = player(() => {
    attempts++;
    throw new Error("Audio device unavailable");
  });
  assert.doesNotThrow(() => receive({ type: "play-chime", volume: 0.5 }));
  assert.equal(attempts, 1);
});
