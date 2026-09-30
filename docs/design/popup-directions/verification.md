# Synthetic preview verification — 2026-09-30

These checks cover the design demonstration, not acceptance of a redesigned
extension or real mailbox writes. All mail and addresses are synthetic.

- Native T3 browser: three account sections per theme, with 2/1/1 messages;
  Settings hides mail and includes Themes, Accounts, Notifications and Sound.
- Theme radio controls switch the palette immediately. Native ArrowDown kept
  focus on the selected radio; reload retained the selection in preview-only
  localStorage. Separate keys let all three comparison frames remain independent.
- Read toggles update sample counts; Trash removes a sample message and Undo
  restores it; Open and account connections report simulated behavior.
- Settings back navigation preserves focus; volume feedback updates.
- At a 320px viewport, document widths were 305/305 and popup widths 269/269:
  no horizontal overflow. Desktop comparison checked at 1440×1000.
- Contrast corrections: Slate small count/header 5.270:1; Signal secondary
  text/darkest toolbar gradient stop 4.656:1. Both clear the 4.5:1 minimum.
- `node --check docs/design/popup-directions/preview.js` passed.
- `npm test` passed all 160 existing tests; these are baseline regression checks,
  not prototype interaction tests. Tracked `git diff --check` passed; proposal
  files were untracked during that check.
- Independent re-review: ship at synthetic preview scope; see review.md for
  source bindings and limits. One nonblocking observation remains: switching
  appearance leaves the region label naming the original comparison theme.

Production implementation still requires its specification, provider-write
permissions/authentication design, error recovery, automated verification and
owner Chrome acceptance. Existing production DESIGN.md and runtime are unchanged.
