import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("toolbar uses dedicated grey icons at standard and high pixel density", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));
  assert.ok(manifest.action.default_icon, "toolbar must have its own icon");
  for (const size of [16, 32]) {
    const file = manifest.action.default_icon[size];
    assert.ok(file, `missing ${size}px toolbar icon`);
    assert.notEqual(file, manifest.icons[16], "toolbar must not reuse the blue notification icon");
    const png = await readFile(new URL(file, root));
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.equal(png[25], 6, "toolbar PNG must support transparency (RGBA)");
  }
});
