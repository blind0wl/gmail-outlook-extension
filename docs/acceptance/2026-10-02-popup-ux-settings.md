# Popup UX/settings candidate — 2026-10-02

Implementation candidate: `311ab3aaf324a0647b4d5cfb2d3a45c7e28a999b` on
`feature/popup-ux-settings`; documentation-only commits follow it.
Status: automated and synthetic verification passed; actual unpacked-extension
real-account acceptance remains pending. No historical acceptance is reused.

Environment: Linux workspace, Node 24.19.0, T3 Code collaborative preview
0.0.44 / Electron 44.4.2 / Chromium 152.0.7977.130. Preview served the production
popup via the synthetic fixture; it did not load the unpacked extension or run
real Chrome storage/alarms/provider APIs.

## Verified

- Node 24 `npm ci`: 20 packages, zero reported audit vulnerabilities.
- `npm run verify`: syntax/identity checks and all 283 tests passed.
- `git diff --check`: passed.
- RED/GREEN evidence: deletion tests failed on tray presence and promotional
  copy before removal; link tests failed before helper/header implementation;
  settings tests failed before shared validation/worker handler/form existed.
- Worker doubles: invalid requests, inclusive bounds, 31-second interval,
  named alarm delay/period, preserving matching deadlines, startup reconciliation,
  storage/schedule failure rollback, missing preference/alarm rollback,
  rollback uncertainty and retry, serialized saves and saving during a slow poll.
  Unchanged worker/provider read/Trash/Undo/recovery tests passed.
- Popup doubles: completed saved deletions remain invisible; concise Trash
  success, failure/uncertainty recovery, three distinct heading destinations,
  one active tab/ordinary click, modified-click preservation and account focus.
  Form loads defaults/legacy precision, validates, prevents duplicate saves,
  preserves drafts/focus, and confirms success only after worker response.
- T3 synthetic batch: Mail and Settings at 320px/480px in Midnight/Slate/Signal
  had no horizontal overflow with long account/message content. Native input,
  units and Save fit (320px widths about 95/95/53px). 200% CSS zoom had no
  Settings overflow; this is not native browser zoom acceptance.
- Synthetic browser form Save persisted 31,000ms and reported success. Pending
  Save stayed pending despite a preference event; simulated uncertain failure
  preserved the draft and enabled retry. Twelve saved completed deletions exposed
  no Undo controls. Heading rerender restored the account key and an ordinary
  click produced one synthetic inbox navigation without a mail-action message.
- Snapshot console diagnostics were empty. Browser Tab moved duration → unit;
  activeElement identity was observable, but document.hasFocus() was false in
  the shared host. Native focus-ring rendering and screen-reader output still
  need focused-host acceptance. Focus-visible and forced-color rules are present.
- Impeccable detector: one advisory for the pre-existing Signal swatch #b4b8bc;
  no new palette color was added. Incumbent palette preserved. Source/UX review
  covered correctness, readability, architecture, input/navigation boundaries,
  privacy and bounded work; no additional implementation defect found.

## Pending real-account acceptance

- [ ] Owner tests disposable Gmail conversations and Outlook messages: unchanged
      Trash/read/failure/recovery behavior, provider restore and no visible Undo
      across popup reopen. No mailbox writes were made during this build.
- [ ] Two accounts per provider, both directions: each heading selects its owning
      inbox in exactly one active tab. Missing-session behavior recorded.
      Provider hints are compatibility candidates, not verified routing guarantees.
- [ ] Observe global automatic checks at short/long intervals, reopen/reload,
      worker termination and Chrome restart; verify manual silent Refresh,
      paused accounts, provider backoff and in-flight work remain correct.
- [ ] Focused unpacked-popup keyboard/modified-click/focus-ring, screen reader,
      native 200% zoom and forced-colors acceptance.

Run the candidate checklist in `tests/popup-checklist.md` and append fresh results
with tested commit, browser version and environment. Do not record real mail,
account addresses, credentials or tokens. This record does not authorize release.

## Review fix candidate — 2026-10-02

The response-ordering P2 finding is fixed in `b76ef5c`; see
[the fresh fix record](2026-10-02-poll-settings-response-order.md). The full
suite now passes 285 tests. This adds regression/runtime evidence for the fix;
it does not complete the real-account acceptance items above.

The subsequent stale-success finding is fixed in `090be45` and covered by
fresh results in the response-ordering record. The full suite now passes 286
tests; real-account acceptance remains pending.
