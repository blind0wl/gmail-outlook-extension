# Merged baseline repair checks

Closeout source for the completed repair scope in each bug assessment.
Independent completion review and done transition are separate lifecycle gates.

## Outlook deeplink

- [x] Graph selects webLink; normalization and cache preserve it.
- [x] Popup validates provider URLs and retains fallback for old cached entries.
- [x] Personal Outlook links carry the correct account hint.
- [x] Regression tests and full checks pass; independent implementation review recorded.
- [x] Owner reports exact-message Open works across both Outlook accounts.
- [x] PR #8 merged as 384cd1a; dated acceptance remains equivalent to source.

## Stable extension identity

- [x] Public manifest key pins the unpacked development ID.
- [x] Read-only identity CLI and verification validate the ID/SPA redirect.
- [x] Tests cover Chromium's vector, invalid/private keys and deployment identity.
- [x] One-time storage/registration migration and future publishing scope documented.
- [x] Owner reports browser ID, redirect, sign-in, reload/restart and alternate path/profile checks passed.
- [x] PR #9 merged as de47eae; dated acceptance remains equivalent to source.
