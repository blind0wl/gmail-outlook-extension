# Project baseline — 2026-09-30

This checkpoint separates verified development checks from pending Chrome
acceptance. It does not mark the baseline or reliability work done.

## Development checks

- Cleanup is submitted in PR #6 (`chore/repository-cleanup`, commit `1b94326`).
- Node 24 is the documented/CI baseline; `.nvmrc` records its major version.
- A fresh install with Node 24.21.0 passed, with zero reported dependency
  vulnerabilities. `npm run verify` passed 30 syntax checks and 152 tests.
- `npm test` explicitly selects `tests/*.test.js`. The previous directory
  argument fails on Node 24, although it works on the installed Node 26.10.0.
- CI runs the same checks with read-only permissions and SHA-pinned actions.
  Remote CI results must be checked on the submitted PR.
- README.md covers setup, architecture, commands, limitations, and Chrome
  acceptance. The constitution records existing agreed project principles.

## Documentation and tracker reconciliation

The v1 spec now describes the actual Gmail feed transport, fetch hosts,
provider bounds, and opt-in focused-tab suppression. Historical plan steps
remain explicitly historical. Existing human checklist ticks are preserved
as history, not claimed for this candidate.

Issue #2 was closed on GitHub after verifying its merged fix and regression
test; its local status was already done. No new product commitments are
inferred from the old plan.

## Proposed canonical state updates

Only the canonical writer named in `.dev/project.md` applies these updates:

- `.dev/verification.yaml`: replace the automated gate command with
  `["npm", "test"]` so its test selection works on the documented Node 24
  baseline. This preserves the full suite and does not weaken acceptance.
- `.dev/project.md`: correct the obsolete open-decision text for issues #2
  and #3; both fixes are merged. The old feature branch is absent from the
  inspected local and remote-tracking refs. Link README.md for current setup.
- `.dev/work.yaml`: clear the completed issue-3 focus or select the agreed
  baseline work. Keep `outlook-deeplink` queued until its required gates pass.

These shared state files have not been changed by this observer session.

## Remaining work

- Existing popup design is documented in DESIGN.md; five synthetic browser
  captures and a reusable fixture are in `docs/ui-baseline/` and `tests/visual/`.
  These references do not establish real-account or accessibility acceptance.
- Owner reported commit `604b03a` tested and passed on Helium 0.18.1.1,
  Chromium 154.0.8037.57, Arch Linux x86_64. The dated report is in
  `docs/acceptance/2026-09-30-baseline.md`. Specific previously known Outlook
  link and stable-identity limitations remain pending investigation.
- Repair Outlook's exact-message Open link with a validated provider webLink.
- Pin a stable extension public key and register its derived Microsoft
  redirect URI. Verify sign-in after reload/restart; an identity change can
  require reconnecting accounts in the new extension storage namespace.

The spec also describes an unimplemented header search icon and popup controls
for poll interval/enabled/notify settings. They remain scope decisions, not
baseline features silently added during hardening.

## Implementation sources

- [Node 24 test runner](https://nodejs.org/docs/latest-v24.x/api/test.html)
  documents quoted glob selection for portable command-line test discovery.
- [actions/setup-node](https://github.com/actions/setup-node) documents
  `node-version-file` and npm cache setup.
- [actions/checkout](https://github.com/actions/checkout) documents checkout
  behavior and credential persistence controls.
