# Count badge refinement — 2026-10-03

Owner reported oval or poorly centred account counts in the extension popup.
Candidate: uncommitted changes in `src/popup/popup.css`.

Before the fix, synthetic Chromium measured account counts at 22 × 20px and
the toolbar count at 22.0625 × 20px. Both now use a 22px minimum width and
22px height, less horizontal padding and explicit line-height 1. Single digits
are circles; longer values widen into pills. Grid alignment and toolbar shrink
protection preserve sizing. Colours, zero-count treatment and count semantics
remain intact.

Fresh verification:

- Node 24.21.0, `npm ci`, `npm run verify`: 336 tests pass, syntax/identity checks pass.
- T3 Chromium 152.0.7977.130 synthetic production fixture: 144 measurements
  across Midnight/Slate/Signal, 320px/480px root widths, both badge selectors,
  values 0/1/8/12/999/12345. Every single-digit badge is 22 × 22px; text fits
  all cases. Text-box centres differ by at most 0.008px horizontally and 0px
  vertically. This measures font text boxes, not individual glyph ink.
- Slate screenshot inspected; no console errors. `git diff --check` passes.
- One Impeccable scan reports incumbent swatch-border and design-token
  advisories away from the changed badges; no new badge findings.

Fresh real-account acceptance is **pending**. Reload the unpacked extension,
then check the account and Inbox counts for round single-digit shapes and
visually centred numerals. Agent checks used synthetic mail only.
