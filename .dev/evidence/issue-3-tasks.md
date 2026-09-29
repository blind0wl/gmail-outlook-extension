# issue-3 tasks

Completed steps for the case-insensitive account resolution fix. All boxes are checked. No open boxes remain.

- [x] Symptom captured: mixed-case stored addresses missed lifecycle lookups, losing Sign in/out/Remove controls and status rows.
- [x] Root cause isolated: raw-case `accountKey`, unnormalized stored records, provider-case cache identity, raw-case popup status keys.
- [x] Regression test written in `tests/account-case.test.js` and observed to fail on pre-fix code.
- [x] Repair applied: case normalization at ingestion and in `accountKey` across store, both providers, and popup status keys.
- [x] Regression test passes post-fix and the full suite passes 152/152 on the merged candidate.
- [x] Human gate pass recorded: all checks pass except the Outlook card, tracked as `outlook-deeplink`. PR #5 merged.
