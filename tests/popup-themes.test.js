import test from "node:test";
import assert from "node:assert/strict";
const themes = () => import("../src/popup/themes.js");

test("theme preference validates saved values and uses Midnight for existing or new profiles", async () => {
  const { loadTheme, saveTheme } = await themes();
  const data = {};
  const store = { get: async () => data, set: async patch => Object.assign(data, patch) };
  assert.equal(await loadTheme(store), "midnight");
  data.popupTheme = "unknown-theme";
  assert.equal(await loadTheme(store), "midnight");
  await saveTheme("slate", store);
  assert.equal(await loadTheme(store), "slate");
  await saveTheme("signal", store);
  assert.equal(await loadTheme(store), "signal");
  await assert.rejects(saveTheme("url(something)", store), /Unknown/);
  assert.equal(data.popupTheme, "signal", "invalid choices never overwrite a saved value");
});

test("failed theme storage is observable and does not poison subsequent saves", async () => {
  const { loadTheme, saveTheme } = await themes();
  await assert.rejects(loadTheme({ get: async () => { throw new Error("read failed"); } }), /read failed/);
  await assert.rejects(saveTheme("slate", { set: async () => { throw new Error("write failed"); } }), /write failed/);
  const data = {};
  await saveTheme("midnight", { set: async patch => Object.assign(data, patch) });
  assert.equal(data.popupTheme, "midnight");
});

test("rapid theme selections serialize persistence so the final choice survives reopen", async () => {
  const { loadTheme, saveTheme } = await themes();
  const data = {};
  let release;
  const calls = [];
  const store = {
    get: async () => data,
    set: async patch => {
      calls.push(patch.popupTheme);
      if (calls.length === 1) await new Promise(resolve => { release = resolve; });
      Object.assign(data, patch);
    },
  };
  const first = saveTheme("slate", store);
  const last = saveTheme("signal", store);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ["slate"], "second storage write waits for the first");
  release();
  await Promise.all([first, last]);
  assert.deepEqual(calls, ["slate", "signal"]);
  assert.equal(await loadTheme(store), "signal");
});
