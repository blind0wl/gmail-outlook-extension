import { readFileSync } from "node:fs";
import { createHash, createPublicKey } from "node:crypto";

try {
  const manifest = JSON.parse(readFileSync(
    process.argv[2] ?? new URL("../manifest.json", import.meta.url), "utf8",
  ));
  if (typeof manifest.key !== "string" || !manifest.key) throw new Error();
  const bytes = Buffer.from(manifest.key, "base64");
  if (bytes.toString("base64") !== manifest.key) throw new Error();
  const publicKey = createPublicKey({ key: bytes, format: "der", type: "spki" });
  if (!publicKey.export({ format: "der", type: "spki" }).equals(bytes)) throw new Error();

  // Chromium: first 16 SHA-256 bytes of the public key, hex mapped to a-p.
  const id = createHash("sha256").update(bytes).digest("hex").slice(0, 32)
    .replace(/[0-9a-f]/g, digit => String.fromCharCode(97 + parseInt(digit, 16)));
  console.log(`Extension ID: ${id}`);
  console.log(`Microsoft redirect URI: https://${id}.chromiumapp.org/`);
} catch {
  console.error("Extension identity check failed: provide a manifest with a valid base64 SPKI public key.");
  process.exitCode = 1;
}
