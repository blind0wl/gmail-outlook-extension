# Card/action verification

2026-10-01 candidate. Production popup files are exercised through the existing
synthetic fixture at docs/ui-workspace/. Updated fixtures simulate provider
confirmations locally; they never contact Gmail or Graph.

The popup is 480px wide and 600px tall intrinsically, constrained by host width.
Messages use separate theme panel surfaces, 12px corners and 8px gaps beneath
account headers. Sender/subject are 600-weight regardless of read state; preview
is static plain text clamped to three lines. Hover and focus-within reveal 34px
read/Trash buttons; non-hover devices show them. Full in-extension reading is
intentionally deferred, and provider Open retains existing behavior.

Independent code review identified and resolved pre-POST and late-storage-read
sign-out races, journal resurrection after account removal, post-send uncertainty,
and unbounded expired Undo content. Tests bind these behaviors to regressions.
Gmail Undo only accepts a positive action acknowledgement; an unrecognized reply
requires checking the provider, and cannot be blindly replayed. Real session
compatibility, especially the legacy restore endpoint, remains owner acceptance.

T3 inspected Midnight and Slate at 480px and Signal long-content at 320px.
Preview clamping, no horizontal overflow, native keyboard actions and synthetic
Trash/Undo passed. Inspected snapshots had no console errors. Detector output is
retained alongside this record; its sole advisory is a pre-existing theme swatch.
See the fresh dated acceptance record; automated checks do not establish real
mailbox/auth success.

Final validation: Node 24.21.0, npm ci and npm run verify passed all 192 tests;
git diff --check passed. midnight-480.png is a synthetic screenshot from the
production-file fixture after keyboard Trash/Undo, with the actions revealed
by keyboard focus. It contains only example.test addresses and invented mail.
