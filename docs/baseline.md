# Project baseline — 2026-09-30

This checkpoint preserves the baseline work and its verification history.
The current state reconciliation is recorded in `.dev/project.md` and the
merged-fix checkpoints under `.dev/evidence/`.

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

## Canonical state reconciliation — 2026-09-30

The owner authorized this session to reconcile `.dev` on behalf of **dave**.
The current test gate uses `npm test`, preserving full suite selection on
Node 24. Obsolete branch decisions and issue-3 focus are cleared; completed
issue phases are corrected. Outlook/identity checkpoints bind merge and
acceptance evidence. Historical checkpoints remain unchanged.

Independent closeout review is recorded in
`.dev/evidence/baseline-closeout-audit.md`. The low-priority Gmail stale-link
finding is queued separately; no persistent restoration was observed.

## Remaining work

PR #6 merged as `1863fbc`; PR #7 squash-merged as `0a78989` on 2026-09-30.
The merged baseline passed 31 syntax checks and all 152 tests locally.

- Existing popup design is documented in DESIGN.md; five synthetic browser
  captures and a reusable fixture are in `docs/ui-baseline/` and `tests/visual/`.
  These references do not establish real-account or accessibility acceptance.
- Owner reported commit `604b03a` tested and passed on Helium 0.18.1.1,
  Chromium 154.0.8037.57, Arch Linux x86_64. The dated report is in
  `docs/acceptance/2026-09-30-baseline.md`. Later focused acceptance of the
  Outlook link and stable identity repairs is recorded separately below.
- Outlook's exact-message Open link now uses a validated provider webLink.
  Implementation and synthetic verification are recorded in
  `.specify/bugs/outlook-deeplink/`; PR #8 merged and owner acceptance passed.
- PR #9 pins a stable extension public key; all focused owner checks passed
  on `fb18eb9`, including registration and reload/restart/path verification.
  See `docs/acceptance/2026-09-30-extension-identity.md`. PR #9 squash-merged as `de47eae`. Setup for future installs is in `docs/extension-identity.md`.

PR #8 squash-merged as `384cd1a`; the merged Outlook link fix passed 157 tests
and 32 syntax checks. Owner acceptance of two-account Open is recorded in
`docs/acceptance/2026-09-30-outlook-links.md`. The index is reconciled against
these merges and acceptance records; see the current closeout checkpoints.

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
