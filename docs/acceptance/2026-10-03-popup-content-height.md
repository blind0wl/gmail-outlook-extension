# Popup content height candidate — 2026-10-03

The owner requested removal of unused space below empty accounts, retaining
the existing popup size when mail needs it. The shell now sizes to its content
with a 600px maximum, preserving the independently scrolling Mail/Settings view.
This supersedes DESIGN.md's fixed-height shell requirement; the height remains
independent of the host's initial viewport. No provider or worker behavior changes.

## Fresh verification

- Node 24.21.0, `npm ci` and `npm run verify`: syntax/identity checks pass;
  all 346 tests pass. `git diff --check` passes.
- T3 browser synthetic production fixture: three accounts without mail shrink
  from 600px to 440.5px. One email grows the shell to 505.7px. Fifteen emails
  reach 600px, with a 542px Mail viewport and working scroll to the end.
  Removing those emails shrinks the shell back to 440.5px.
- Settings retains the 600px shell and independent scrolling. At 320px width,
  its bottom Save control is reachable without horizontal overflow; Back
  restores the compact Mail view. Empty-account Mail also has no horizontal
  overflow at 320px. A 240px initial browser viewport still produces the
  content's 440.5px intrinsic shell height, independent of viewport height.
- Added `state=caught-up` to the synthetic fixture to reproduce configured
  accounts with no cached mail. The existing no-account fixture still exposes
  Open Settings and sizes to its content.
- Independent code review found no correctness issues. One Impeccable scan
  found 13 existing findings on unchanged declarations (one miniature theme
  swatch accent warning and twelve typography/radius advisories); none concern
  the height change. No unrelated style changes or detector ignores added.

## Real-account Chrome acceptance

Pending for this candidate; synthetic page layout does not establish Chrome's
actual extension popup host sizing. Historical acceptance results are not reused.

- [ ] Reload the unpacked extension, then open Mail with caught-up accounts:
      the popup ends just below the explanatory note.
- [ ] With a short mail list, the popup grows only as much as required.
- [ ] With a longer list, it reaches the existing maximum and scrolls.
- [ ] After emails disappear, or a provider filter reduces the list, it shrinks.
- [ ] Settings remains scrollable; returning to Mail restores compact sizing.
- [ ] Close/reopen preserves sizing across the three themes.
