# Stable identity verification

Date: 2026-09-30. Assessment: assessment.md. Fix: fix.md.
Result: **partial** — external registration and Chrome acceptance pending.

| Check | Result |
| --- | --- |
| Regression before manifest key | Failed: repository has no valid public key |
| Known Chromium public-key vector in two directories | Passed: expected ID and redirect |
| Invalid/missing/noncanonical/private-key inputs | Passed: exit 1, no identity/private bytes printed |
| Repository identity from a different cwd | Passed: exact pinned deployment ID |
| npm run verify, installed Node 26 | 161 tests, 34 syntax checks, identity command passed |
| Node 24.21.0 full suite, syntax and identity scripts | 161 tests, 34 syntax checks, identity command passed |
| git diff --check | Passed |
| Actual browser ID/getRedirectURL, Entra SPA registration, sign-in/reload/restart/path | Not run; owner steps in docs/extension-identity.md |

The algorithm/vector checks establish the expected ID, not an observed Chrome
installation. The T3 preview is a web fixture, not the owner's unpacked install
or authenticated Entra portal; no browser or registration pass is invented.
The one-time ID change can require re-adding accounts/preferences. Keep old
data, disable any old duplicate, register the new redirect before auth testing.
Independent review and final owner acceptance remain required before closeout.
