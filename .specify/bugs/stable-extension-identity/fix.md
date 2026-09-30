# Stable identity repair

Date: 2026-09-30. Assessment: assessment.md. Status: applied.

manifest.json now includes a generated RSA-2048 public SPKI key. Only public
bytes were saved; the private key was never written to disk. The expected
development ID is `jholbbifabgjdjiiebpghejakkejdpdf` and the Microsoft redirect
is `https://jholbbifabgjdjiiebpghejakkejdpdf.chromiumapp.org/`.

scripts/extension-identity.mjs validates canonical base64 SPKI public bytes,
rejects private/malformed/missing keys, then uses Chromium's ID derivation
and prints the ID/redirect. npm run identity exposes it; npm run check/verify
include it. Tests run the CLI on temporary manifests in separate directories,
use Chromium's known vector, refuse private bytes without logging them, and
pin the repository's external identity contract. README, manual auth and
docs/extension-identity.md cover the one-time storage change, exact SPA
registration, browser ID checks, reload/restart recovery and future store scope.

Observed red: CLI initially unavailable; once present, its Chromium vector and
invalid-key tests passed but the repository check failed for the missing
manifest key. After pinning the key all four focused tests pass.

Full verification passes 161 tests, 34 syntax checks and the identity command
on Node 26 and Node 24.21.0. No extension runtime JS, permissions, providers,
scopes, dependencies, existing stores or external registrations were modified.
The actual browser install and owner Entra registration/acceptance are pending.
This is implementation, not project completion. No deviations from assessment.
