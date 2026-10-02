# Check-frequency response ordering — 2026-10-02

Candidate: `b76ef5c8d823ced42416ff24a380ab079cf92a0b`,
`feature/popup-ux-settings`. This fixes the P2 finding from branch review:
a delayed initial read or older Save response could replace the displayed
interval while leaving misleading Saved feedback.

Save now invalidates earlier reads. Superseded reads cannot update the value or
report a late failure. When a different preference is observed during Save,
the older response preserves that preference and reports that the interval
changed while saving; another Save can explicitly apply the displayed choice.
A preference event alone never confirms application.

Verification on this candidate:

- Both new regression tests failed on the previous implementation, then passed
  with the fix. The delayed-read test covers successful and failed old reads;
  the newer-event test covers preserved value, honest status and successful retry.
- Node 24.19.0 `npm run verify`: all 285 tests passed, including syntax/identity
  checks and unchanged worker/provider action/scheduling tests.
- `git diff --check`: passed.
- T3 collaborative preview, Linux / Chromium 152.0.7977.130, production popup
  in the synthetic empty-account fixture at 320px: five checks passed for newer
  preference preservation, changed-during-save status, retry availability,
  successful retry and no horizontal overflow. This used mocked Chrome APIs.
- Source review: revision increments cover submission/completion and stale read
  success/failure; same-value worker/storage responses retain normal Saved
  feedback. No new dependencies, permissions or provider changes.

Fresh actual unpacked-extension acceptance remains pending. Use two popup or
Settings contexts to save different intervals while replies are delayed; verify
the latest preference remains displayed and status is honest. Also verify normal
Save/reopen. Existing real-account routing, Trash/recovery and live scheduling
checks in [the feature record](2026-10-02-popup-ux-settings.md) remain pending.
No real mail or credentials were accessed, and no mailbox writes occurred.

## Follow-up: stale success after preference changes — 2026-10-02

Candidate: `090be453bed4a2a87d4dbeff43254b692c4130ea`.
A different effective preference arriving after successful Save now clears the
old success status. A matching notification retains valid success feedback;
pending submissions keep their Applying status until the worker response.

Fresh verification:

- The new regression failed on stale Saved text before the fix and passed after
  it. It covers matching notifications, changed preferences and explicit re-save.
- Node 24.19.0 `npm run verify`: all 286 tests passed; `git diff --check` passed.
- T3 synthetic production popup at 320px: five checks passed for initial success,
  matching-event success retention, updated value display, cleared stale success
  and successful explicit re-save. Same Linux/Chromium preview environment above.
- Source review confirmed clearing only on a changed effective value outside a
  pending submission; previous draft and response-ordering regressions pass.

Actual unpacked-extension acceptance for this candidate remains pending: after
saving in one window, change the preference from another and verify that old
success feedback clears before scheduling is confirmed. No real accounts or
provider writes were used for these checks.
