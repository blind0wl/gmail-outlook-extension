# Stable identity verification

Date: 2026-09-30. Assessment: assessment.md. Fix: fix.md.
Result: **passed for the implementation and focused owner acceptance**.
PR merge and canonical closeout remain separate.

| Check | Result |
| --- | --- |
| Regression before manifest key | Failed: repository has no valid public key |
| Known Chromium public-key vector in two directories | Passed: expected ID and redirect |
| Invalid/missing/noncanonical/private-key inputs | Passed: exit 1, no identity/private bytes printed |
| Repository identity from a different cwd | Passed: exact pinned deployment ID |
| npm run verify, installed Node 26 | 161 tests, 34 syntax checks, identity command passed |
| Node 24.21.0 full suite, syntax and identity scripts | 161 tests, 34 syntax checks, identity command passed |
| git diff --check | Passed |
| Actual browser ID/getRedirectURL, Entra SPA registration, sign-in/reload/restart/path | Owner reported all checks passed on fb18eb9; docs/acceptance/2026-09-30-extension-identity.md |

The algorithm/vector checks establish the expected ID. Actual browser and
registration acceptance comes from the owner's report, not the T3 web fixture.
The one-time ID change can require re-adding accounts/preferences. Keep old
data, disable any old duplicate, register the new redirect before auth testing.
Independent implementation review found no blockers (review.md). Canonical
writer reconciliation and completion audit remain separate from this report.
