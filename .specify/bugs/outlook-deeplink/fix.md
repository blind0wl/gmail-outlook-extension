# Bug Fix: Outlook Open uses the provider message URL

- **Slug**: outlook-deeplink (from assessment context)
- **Fixed**: 2026-09-30
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Graph requests and normalizes webLink; cache merges preserve it through
storage and hydration. Open prefers validated HTTPS URLs on exact Outlook
web origins and otherwise retains the legacy account-aware fallback.

## Changes

| File | Change | Notes |
| --- | --- | --- |
| src/providers/outlook.js | modified | Select and normalize webLink |
| src/store/cache.js | modified | Preserve the optional string field |
| src/popup/links.js | modified | Validate origin and reject credentials before navigation |
| tests/outlook-deeplink.test.js | added | Fetch/cache/restart regression and navigation trust boundary |
| README.md, tests/popup-checklist.md, docs/baseline.md | modified | Current behavior and pending acceptance |
| docs/ui-baseline/README.md | modified | Preserve historical screenshot provenance |

## Tests Added or Updated

The integration test checks Graph query selection, a refresh preserving local
read state, persistence, memory reset, hydration, and the final encoded URL.
Other cases cover three exact Outlook origins, malformed/non-HTTPS/external
URLs, credential-bearing URLs, old caches, and Gmail isolation.
Observed red: two of three tests failed before production changes, on missing
$select webLink and the synthesized URL replacing the supplied message link.

## Local Verification

- `npm run verify`: 32 syntax checks, 155 tests passed.
- Node 24.21.0 `--test "tests/*.test.js"`: 155 tests passed.
- T3 Linux Chromium 152, actual popup via synthetic fixture: cached webLink
  forwarded unchanged to chrome.tabs.create; mark-read message still sent.
  An initial page used cached links.js; fresh navigation on 127.0.0.1 loaded
  the updated source and passed. No real accounts or provider tabs accessed.
- `git diff --check`: passed.

## Deviations from Assessment

Added a provenance note to docs/ui-baseline/README.md because links.js appears
in the historical capture fingerprints. The old images were not regenerated.

## Follow-ups

Owner acceptance of exact-message selection after refresh, extension restart,
and a different Microsoft browser session. Independent completion audit and
canonical writer closeout remain pending that required human gate.
