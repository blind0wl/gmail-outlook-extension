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
