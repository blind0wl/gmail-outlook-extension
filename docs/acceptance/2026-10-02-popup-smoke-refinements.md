# Owner smoke feedback and refinements — 2026-10-02

Owner-reported smoke results from the pre-refinement candidate:

- Inbox heading navigation works on all configured accounts.
- Deleting mail no longer shows Undo.
- Polling settings seem to work well.

The owner supplied these results in the current thread. Tested commit, browser
version, account counts, both-direction routing protocol, restart/schedule timing
and failure/recovery details were not supplied. Record these as passed smoke
observations, without claiming the full acceptance checklist passed.

The owner requested whole-heading hover rather than address-only underlining,
and Mail checking at the bottom of Settings. This supersedes the original
Accounts-adjacent placement requirement.

Refinement candidate: `6788b894b5bbafb9a92bd01a1f9644ad86270c18`.
The existing whole-heading link still opens one inbox tab. Hover keeps the whole
header's theme highlight and removes address underlining. Mail checking now
follows Sound; existing form controls, persistence and draft handling remain.

Fresh verification:

- Updated Settings-order regression failed before the move and passed afterward.
- Node 24.19.0 `npm run verify`: all 286 tests passed; `git diff --check` passed.
- T3 synthetic Chromium 152.0.7977.130: actual pointer hover produced the theme
  background on the entire anchor, address text-decoration was none, and clicking
  opened one synthetic inbox destination.
- Settings at 320px/480px across Midnight/Slate/Signal kept Mail checking last
  with no horizontal overflow. Initial browser connection failure was recovered
  by reopening the preview and restarting the stopped fixture server.
- Impeccable detector had only the incumbent Signal swatch advisory (#b4b8bc);
  no palette changes. Source review found no behavior change beyond hover and
  section order; all current design/spec references match the requested placement.

Fresh owner acceptance of this refinement remains pending. Full real-account
restart, failure/recovery, focused-host accessibility and timing checks from
[the feature checklist](2026-10-02-popup-ux-settings.md) remain outstanding where
not established by the owner's smoke report. No real account content or
credentials were recorded; no mailbox writes occurred during agent verification.
