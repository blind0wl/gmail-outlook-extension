# Visual polish prototype

Interactive exploration of the approved polish direction, built in
`prototype/visual-polish`. The approved direction is now implemented in the extension on this branch.

Run `python3 -m http.server 8767 --bind 127.0.0.1` at the worktree root and open
`http://127.0.0.1:8767/docs/design/visual-polish/`. Stop with Ctrl+C in its terminal.

Current / Proposed switches original and production styling in place. Mail / Settings, the three themes,
480px / 320px widths and sample states can be compared. The iframe loads the
existing production fixture; sample copy, a complete synthetic interval reply,
local Open state and account lifecycle updates are supplied by the comparison.
All actions remain synthetic. No credentials, provider requests or real mail.

Proposed styling emphasizes subjects, quiets timestamps, moves hover/focus actions
to the card footer, wraps account identity, reduces account-heading weight and
Settings repetition, softens controls and adds richer theme previews. Production
icons now sit in a flow-based footer outside the cached-preview toggle. The
comparison adapts the same markup to the frozen original CSS in current.css.
proposed.css retains the original approved prototype measurements as a reference.

The visual direction is owner-approved; fresh extension-candidate acceptance remains pending.
Fresh real-account Chrome acceptance is not applicable to this synthetic prototype
and has not been performed. Production adoption requires its own verification.

## Verification — 2026-10-03

- Node 24.21.0, `npm ci`, `npm run verify`: all 319 tests passed.
- Prototype JavaScript syntax and `git diff --check` passed.
- T3 inspected Mail and Settings, Midnight/Slate/Signal, 480px and 320px.
  Proposed long addresses wrap without horizontal overflow. Popup height is
  600px without a second document scrollbar. Current restores its original icon
  location; Proposed moves icons outside the expansion control.
- Synthetic Mail-checking Save confirmed success at 320px. Links were verified
  inert, including destinations used by middle-click/context menus.
- Independent code review approved after fixing provider-link escape.
- Impeccable's one detector pass reported design-system advisories for deliberate
  prototype typography, palette and swatch geometry. These are proposal values,
  not silent changes to the production design system.

For this review the preview server runs in terminal session `67437`; Ctrl+C
stops it. It is intentionally left running so the owner can inspect the prototype.

## Production adoption — 2026-10-03

The owner approved the prototype and requested implementation. The comparison's
Proposed view now uses the production CSS. Current uses frozen pre-polish CSS
with the live runtime; it is a style comparison, not a historical runtime replay.
The earlier prototype-only statements and 319-test results above describe that
stage. Fresh production verification and pending real-account acceptance are
recorded in ../../acceptance/2026-10-03-visual-polish.md.
