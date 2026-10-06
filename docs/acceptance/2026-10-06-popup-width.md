# Popup width candidate — 2026-10-06

The owner selected 680px after comparing 600px, 680px and 800px options.
The popup now uses a 680px preferred width, retaining `max-width: 100%`
and the existing content-sized shell capped at 600px height. This supersedes
specs/003-mail-cards-actions/spec.md's historical 480px width requirement.
DESIGN.md and the popup surface brief reflect the selected width.

## Fresh verification

- Node 24.21.0: `npm ci` and `npm run verify` pass, including syntax and
  extension identity checks and all 382 tests (zero failures/skips).
- `git diff --check` passes. Inspected the complete diff: the only runtime
  change is the popup's preferred CSS width.
- T3 collaborative browser using the production popup HTML/CSS/JS with
  synthetic account and message boundaries: populated Mail measures 680px
  wide and 554.4375px high, with no horizontal overflow.
- Settings measures 680px by 600px across Midnight, Slate and Signal themes.
  Each has no horizontal overflow and its bottom Save control is reachable
  through the existing independent vertical scroll. Back returns to Mail.
- Full HTML reader at 680px: a 598px-wide frame displays all 32 synthetic
  sections without horizontal overflow. Mail scroll reaches the final paragraph
  (scrollTop 3608); scroll position and iframe identity survive a synthetic
  inbox/status update. The mock write response was made unsuccessful for this
  check so the fixture's simulated read acknowledgement could not remove mail.
- At a 320px host width, the shell shrinks to 320px. Settings has no horizontal
  overflow and Save remains reachable. Full HTML reader and Mail also have no
  horizontal overflow, with all 32 sections rendered.
- One Impeccable scan reports 13 existing findings on unchanged declarations;
  none concerns the width change. No unrelated polish or detector ignores added.

## Real-account Chrome acceptance

Pending for this candidate. The browser smoke uses synthetic mail and does not
establish actual Chrome extension host sizing or real-account behavior.
Historical acceptance ticks are not reused.

- [ ] Reload the unpacked extension and confirm the toolbar popup opens at 680px.
- [ ] Open a real full email and confirm content fits and vertical scroll reaches
      the end; check Settings and return to Mail.
