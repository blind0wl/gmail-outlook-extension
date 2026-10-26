import test from "node:test";
import assert from "node:assert/strict";
import { pollAll } from "../src/background/service-worker.js";

const ACCOUNT = { provider: "gmail", account: "alerts@example.com", enabled: true };

function depsFor(counter, gate) {
  return {
    now: Date.now(),
    getToken: async () => null,
    fetchers: {
      async gmail() {
        counter.calls++;
        await gate.promise;
        return [];
      },
    },
    setBadge: async () => {},
  };
}

test("an alarm poll joins the cycle already in flight instead of queueing another", async () => {
  let release;
  const gate = { promise: new Promise((resolve) => { release = resolve; }) };
  const counter = { calls: 0 };
  const deps = depsFor(counter, gate);

  const first = pollAll([ACCOUNT], deps);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const second = pollAll([ACCOUNT], deps);
  release();
  await Promise.all([first, second]);

  assert.equal(counter.calls, 1);
});
