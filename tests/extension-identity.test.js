import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";

const script = fileURLToPath(new URL("../scripts/extension-identity.mjs", import.meta.url));
// Chromium's public-key test vector and literal expected ID, not a second
// implementation of its hashing algorithm. See id_util_unittest.cc.
const vector = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC4fysg3HybDNxRYZkNNg/UZogIVYTVOr8rpGSFewwEEz+N9Lw4DUn+a8RasEBTOtdmCQ+eNnQw2ooxTx8UUNfHIJQX3k65V15+CuWyZXqJTrZH/xy9tzgTr0eFhDIz8xdJv+mW0NYUbxONxfwscrqs6n4YU1amg6LOk5PnHw/mDwIDAQAB";
const expected = "Extension ID: melddjfinppjdikinhbgehiennejpfhp\nMicrosoft redirect URI: https://melddjfinppjdikinhbgehiennejpfhp.chromiumapp.org/\n";

function workspace(t) {
  const directory = mkdtempSync(join(tmpdir(), "extension-identity-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function run(directory, manifest) {
  const path = join(directory, "manifest.json");
  writeFileSync(path, JSON.stringify(manifest));
  return spawnSync(process.execPath, [script, path], { cwd: directory, encoding: "utf8" });
}

test("identity command matches Chromium's known ID and redirect across directories", (t) => {
  for (let i = 0; i < 2; i++) {
    const result = run(workspace(t), { key: vector });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
  }
});

test("identity command rejects missing, corrupt, and non-canonical public keys", (t) => {
  const directory = workspace(t);
  for (const key of [undefined, 42, "not-a-key", vector + "!", Buffer.from("not DER").toString("base64")]) {
    const result = run(directory, { key });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /valid base64 SPKI public key/);
  }
});

test("identity command refuses private-key bytes without printing them", (t) => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const key = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
  const result = run(workspace(t), { key });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /valid base64 SPKI public key/);
  assert.equal(result.stderr.includes(key), false);
});

test("repository manifest has a pinned identity even when invoked from another directory", (t) => {
  const result = spawnSync(process.execPath, [script], {
    cwd: workspace(t), encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  // Deployment identity contract: rotating even a valid key would change
  // Chrome storage and the Microsoft registration, so fail until reviewed.
  assert.equal(result.stdout, "Extension ID: jholbbifabgjdjiiebpghejakkejdpdf\nMicrosoft redirect URI: https://jholbbifabgjdjiiebpghejakkejdpdf.chromiumapp.org/\n");
});
