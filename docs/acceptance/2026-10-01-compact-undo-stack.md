# Compact Undo stack — 2026-10-01

Candidate: top Undo tray; newest deletion first; bounded height; live expiry.

## Automated and synthetic results

- Node 24.19.0, npm ci: passed, zero audit findings.
- npm run verify: 51 JavaScript syntax checks and 258 tests passed.
- Regression tests: newest-first ordering, expired/foreign filtering, retained
  individual Undo action and focus, timer expiry without storage events,
  Settings visibility and retained collapse state.
- T3 collaborative browser, synthetic `tests/visual/popup.html?state=undo`:
  480px and 320px at 600px height; all three theme tokens; no horizontal overflow.
  Twelve Undo records use a 112px scroll viewport. Adding a newer record preserves
  Mail top (221.5px), tray height (147.5px) and Mail scroll (80px) at 480px.
  Keyboard Enter collapses the disclosure. Settings hides it; Back restores it.
- Independent source review: stale success message corrected; timer refresh now
  preserves pointer scroll when the newest record is unchanged.
- Impeccable detector: one pre-existing advisory for `#b4b8bc` at popup.css:111;
  no colors introduced by this change. Existing advisory left outside this scope.

## Fresh real-account Chrome acceptance: pending

These synthetic checks do not establish real-provider Trash/Undo acceptance.
Reload the unpacked extension and verify:

- Delete several messages; newest Undo appears first at the top, with no growing
  tray or repeated downward scroll needed to reach mail.
- Scroll older Undo entries and restore the intended message to its own account.
- Collapse/expand the tray; open Settings and return to Mail.
- Close/reopen the popup within ten minutes; saved Undo remains available.
- Leave the popup open past a saved deadline; expired Undo disappears. The message
  remains recoverable through the provider's Trash/Deleted Items as applicable.

No real-account action was performed for this candidate. Provider transports,
write permissions and the worker's ten-minute durable window are unchanged.
