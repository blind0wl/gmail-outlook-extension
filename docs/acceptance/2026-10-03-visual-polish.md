# Visual polish candidate — 2026-10-03

Branch: `prototype/visual-polish`, based on `d31f324` (candidate changes uncommitted).
The owner approved the interactive prototype and requested production adoption.
This record is a fresh candidate result; earlier acceptance is not reused.

## Result

Automated and synthetic browser checks passed. Independent code review found no
blocking or important issues. Fresh real-account Chrome acceptance is **pending**;
no real mailbox, credentials or provider writes were accessed for verification.

## Changes

- All three approved themes retained; Midnight panel #253948 and quieter lines.
- Slim wrapping account headings, primary 15px subjects capped at two lines,
  muted 12px senders, 11px regular timestamps and stable 32px footer icons.
- Native footer action buttons sit outside the preview control. Enter/Space no
  longer expands the preview when an action is focused.
- Compact Settings actions, shared removal guidance, local reconnection hints,
  miniature theme previews and narrow/zoom wrapping. Section order retained.
- No worker/provider behavior changes. Read grace, local Open, Trash/recovery,
  popup cache-only boundaries and theme preference remain.

## Verification

- Node 24.21.0, `npm ci`, `npm run verify`: all 319 tests pass, syntax/identity
  checks pass. Prototype module syntax and `git diff --check` pass.
- Keyboard regression first failed because Enter on Open was intercepted;
  passed after separating preview and footer controls. Existing structural
  layout-only test replaced by the native-activation regression.
- T3 production fixture: Mail/Settings, Midnight/Slate/Signal, 480px/320px;
  long addresses and cached strings, Add Gmail, sign-in/paused states,
  grouped unconfirmed recovery and action failure. No page horizontal overflow
  in inspected ordinary states. Footer/error bounding boxes do not overlap.
- Live keyboard Open: focus preview, Tab to Open, Enter records local mark-read
  and the exact synthetic provider URL; card leaves instead of expanding.
- Theme selection and account reconnection guidance retain state after renders.
- 200% CSS-zoom emulation with a 160px root and 300px body in a 320x600 viewport:
  Settings wraps without horizontal overflow. This is not real browser zoom.
- One Impeccable detector pass: one advisory for retained 14px fallback heading;
  documented as form-heading. No detector ignores added. Inputs retain the
  higher-contrast muted boundary; approved ordinary button lines stay softer.
- Independent code review approved the footer/focus/pending behavior and style
  comparison. Original CSS in docs/design/visual-polish/current.css matches the
  original HEAD byte for byte.

## Explicit discrepancies / scope

Older specs/003 says no preview expansion. The incumbent runtime already expands
cached text, the approved prototype preserved it, and this visual pass retains
that behavior. This record identifies the discrepancy without silently changing
mail-reading scope. No full-message reader is added.

The existing provider-unread explanatory note and Sign out wording remain;
this task implements the approved visual proposal, not the separate copy review.
Prototype sample copy and mock runtime patches are not shipped into production.

## Fresh owner acceptance still required

Load/reload the unpacked extension from this worktree root, then check:

- [ ] Real popup opens at its intrinsic size; Mail and Settings show the approved look.
- [ ] All themes persist after close/reopen; Back restores Mail position.
- [ ] Full account identities remain clear with actual account/message lengths.
- [ ] Mouse and keyboard Open/read/Trash work, with read grace reversal and
      failed-action recovery on disposable test mail.
- [ ] Account controls, sound/alerts and Mail checking save/reopen still work.
- [ ] Actual Chrome 200% zoom and visible keyboard focus remain usable.

Record browser/provider coverage and outcomes here after testing this candidate.
