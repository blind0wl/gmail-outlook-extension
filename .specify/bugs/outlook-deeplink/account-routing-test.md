# Verification update: Outlook.com mailbox hints

Date: 2026-09-30. Assessment: account-routing-assessment.md.
Fix: account-routing-fix.md. Result: **partial** (final owner gate pending).

| Check | Result |
| --- | --- |
| Pre-fix focused regression | 4 failed, 1 passed; missing/wrong login_hint |
| npm run verify | 157 tests, 32 syntax checks passed |
| Node 24.21.0 full glob suite and scripts/check.mjs | 157 tests, 32 syntax checks passed |
| Actual popup Open in T3 Chromium 152 synthetic fixture | Two owning hints emitted; encoded ItemID preserved |
| Owner raw provider URL with initial account hint, browser on second | Passed: initial account's exact message opened |
| Owner final popup in both mailbox directions | Pending |

The hint experiment is runtime evidence; it is not a complete extension
acceptance of the final candidate. The Graph documentation does not promise
this extra parameter's behavior; both real browser directions remain required.
Existing strict HTTPS origins/credential rejection and old-cache fallback
are retained. No credentials or real mail data appear in these artifacts.

The canonical writer still owns state and final closeout; no done claim here.
