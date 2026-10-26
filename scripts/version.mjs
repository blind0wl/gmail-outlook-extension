#!/usr/bin/env node
// One extension version per pull request. Chrome accepts one to four
// dot-separated integers, each 0-65535, with no leading zeroes.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const MAX_VERSION_COMPONENT = 65535;
const scriptPath = fileURLToPath(import.meta.url);
export const DEFAULT_MANIFEST_PATH = path.resolve(path.dirname(scriptPath), "..", "manifest.json");

export function parseVersion(value) {
  const text = String(value ?? "");
  if (!/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/.test(text))
    throw new Error(`invalid extension version "${text}"`);
  const parts = text.split(".").map(Number);
  if (parts.some((part) => part > MAX_VERSION_COMPONENT))
    throw new Error(`extension version component exceeds ${MAX_VERSION_COMPONENT}`);
  return parts;
}

// The pull request number is unique and increases over time. Keep the
// branch's major and minor so a hand-set 0.2.0 stays on the 0.2 line.
export function versionForPullRequest(current, prNumber) {
  const [major, minor] = parseVersion(current);
  const pullRequest = Number(prNumber);
  if (!Number.isInteger(pullRequest) || pullRequest < 1 || pullRequest > MAX_VERSION_COMPONENT)
    throw new Error(`invalid pull request number "${prNumber}"`);
  return [major, minor, pullRequest].join(".");
}

export function versionChanged(base, current) {
  return String(base ?? "").trim() !== String(current ?? "").trim();
}

export async function readManifest(file = DEFAULT_MANIFEST_PATH) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function bumpManifest(prNumber, file = DEFAULT_MANIFEST_PATH) {
  const manifest = await readManifest(file);
  const next = versionForPullRequest(manifest.version, prNumber);
  if (next === manifest.version) return { changed: false, version: next };
  manifest.version = next;
  await writeFile(file, JSON.stringify(manifest, null, 2) + "\n");
  return { changed: true, version: next };
}

function optionsFrom(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || value === undefined)
      throw new Error(`expected --name value, received "${flag ?? ""}"`);
    options[flag.slice(2)] = value;
  }
  return options;
}

async function main(args) {
  const [command, ...rest] = args;
  const options = optionsFrom(rest);
  const file = options.manifest ? path.resolve(options.manifest) : DEFAULT_MANIFEST_PATH;

  if (command === "show") {
    const manifest = await readManifest(file);
    console.log(parseVersion(manifest.version).join("."));
    return;
  }
  if (command === "bump") {
    const result = await bumpManifest(options.pr, file);
    console.log(`${result.changed ? "version" : "unchanged"} ${result.version}`);
    return;
  }
  if (command === "check") {
    const manifest = await readManifest(file);
    parseVersion(manifest.version);
    if (!versionChanged(options.base, manifest.version)) {
      console.error(`manifest.json is still at ${manifest.version}; set a new version for this pull request`);
      process.exitCode = 1;
      return;
    }
    console.log(`version ${manifest.version}`);
    return;
  }
  throw new Error("usage: version.mjs show | bump --pr <number> | check --base <version> [--manifest <path>]");
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
