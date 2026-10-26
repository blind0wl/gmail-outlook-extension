import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  bumpManifest,
  parseVersion,
  versionChanged,
  versionForPullRequest,
} from "../scripts/version.mjs";

test("accepts Chrome extension versions and rejects invalid components", () => {
  assert.deepEqual(parseVersion("0.1.0"), [0, 1, 0]);
  assert.deepEqual(parseVersion("1.2.3.4"), [1, 2, 3, 4]);
  assert.throws(() => parseVersion("0.1.01"));
  assert.throws(() => parseVersion("0.1.70000"));
  assert.throws(() => parseVersion("0.1."));
  assert.throws(() => parseVersion(""));
});

test("a pull request version keeps major and minor and uses the PR number", () => {
  assert.equal(versionForPullRequest("0.1.0", 41), "0.1.41");
  assert.equal(versionForPullRequest("0.2.7", 42), "0.2.42");
  assert.throws(() => versionForPullRequest("0.1.0", 0));
  assert.throws(() => versionForPullRequest("0.1.0", 65536));
  assert.throws(() => versionForPullRequest("0.1.0", "abc"));
});

test("version changes are detected against the base branch", () => {
  assert.equal(versionChanged("0.1.0", "0.1.0"), false);
  assert.equal(versionChanged("0.1.0", "0.1.41"), true);
});

test("bumping writes only the version and is idempotent for the same PR", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gpo-version-"));
  const file = path.join(directory, "manifest.json");
  await writeFile(file, JSON.stringify({ name: "Gmail plus Outlook", version: "0.1.0", key: "public" }, null, 2) + "\n");
  try {
    assert.deepEqual(await bumpManifest(41, file), { changed: true, version: "0.1.41" });
    const manifest = JSON.parse(await readFile(file, "utf8"));
    assert.equal(manifest.version, "0.1.41");
    assert.equal(manifest.name, "Gmail plus Outlook");
    assert.equal(manifest.key, "public");
    assert.deepEqual(await bumpManifest(41, file), { changed: false, version: "0.1.41" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
