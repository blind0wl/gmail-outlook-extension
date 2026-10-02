# Tasks: Popup UX and global check frequency

**Date**: 2026-10-02
**Status**: Build authorized; implementation and automated/synthetic verification
complete 2026-10-02. Task 1 real-provider routing and Task 8 actual extension
acceptance remain pending.
**Plan**: [plan.md](plan.md). **Specs**: [spec.md](spec.md).
This is the owner-selected task list target; preserve existing `tasks/` files.
The owner approved the specs/plan and invoked `/build auto`, superseding the
earlier inspection-only restriction.

## Task 1: Establish account inbox routing

**Module**: `account-inbox-navigation`
**Description**: Validate the candidate Gmail and Outlook inbox URLs with
read-only browser navigation before changing the popup.

**Acceptance criteria:**
- [ ] Each provider selects the owning inbox in both directions with two accounts.
- [ ] Missing-session behavior is recorded; no default-account shortcut substitutes for correct routing.
- [x] Evidence is synthetic or sanitized and explicitly distinguishes URL tests from real-account results.

**Verification:** Read-only webmail navigation; record browser/version and date.
Do not mutate mail or store addresses/session data in artifacts.
**Dependencies:** None.
**Files likely touched:** `specs/004-popup-ux-settings/research.md`.
**Estimated scope:** Small, one evidence document.

## Task 2: Remove visible Undo feedback

**Module**: `delete-feedback`
**Description**: Remove confirmed-Undo presentation while keeping account-scoped
uncertainty recovery and the existing worker action lifecycle.

**Acceptance criteria:**
- [x] Trash hides the card and reports success without an Undo tray, button or promotional copy, including after reopen.
- [x] Failed/uncertain deletion retains card restoration, locks and “I’ve checked” recovery.
- [x] Worker journal, restore command and provider behavior remain unchanged.

**Verification:** `node --test tests/popup-ui.test.js tests/worker-mail-actions.test.js`;
focused regression tests fail before the UI change and pass afterward; synthetic
mixed-state journal/reopen check.
**Dependencies:** None; execute after Task 1 to resolve routing risk early.
**Files likely touched:** `src/popup/popup.html`, `src/popup/popup.js`,
`src/popup/popup.css`, `tests/popup-ui.test.js`.
**Estimated scope:** Medium, four files.

## Checkpoint A: Baseline behavior preserved

- [x] `npm run verify` passes under Node 24; unchanged worker/provider tests remain.
- [x] Synthetic recovery works without Undo; account routing evidence or its blocker is explicit.
- [x] Review changes against approved specs before continuing.

## Task 3: Make account headings inbox links

**Module**: `account-inbox-navigation`
**Description**: Add the verified pure URL helper and native whole-header link,
preserving heading content and focused account identity across rerenders.

**Acceptance criteria:**
- [ ] Pointer/keyboard activation opens one owning-inbox tab and performs no mailbox action/cache write. Synthetic activation passes; provider selection pending.
- [x] Empty/paused/error accounts, provider filters and same-provider accounts retain correct independent links.
- [x] Hover/focus feedback, accessible names and surviving keyboard focus work in all themes.

**Verification:** `node --test tests/popup-links.test.js tests/popup-ui.test.js`;
synthetic native link/tab interaction and focus checks.
**Dependencies:** Task 1; execute after Task 2 because popup files overlap.
**Files likely touched:** `src/popup/links.js`, `src/popup/popup.js`,
`src/popup/popup.css`, `tests/popup-links.test.js`, `tests/popup-ui.test.js`.
**Estimated scope:** Medium, five files.

## Task 4: Apply global intervals in the worker

**Module**: `check-frequency`
**Description**: Introduce shared settings validation and the worker message
contract, including serialized saves, rollback and alarm reconciliation.

**Acceptance criteria:**
- [x] Valid saves persist and replace one named alarm; invalid input affects neither storage nor scheduling.
- [x] Matching alarms survive worker wake without countdown reset; missing/mismatched alarms reconcile to the saved interval.
- [x] Failed storage/scheduling and repeated saves return honest results; polls, mutation locks, backoff and notification baselines remain intact.

**Verification:** `node --test tests/poll-settings.test.js tests/worker-poll-settings.test.js tests/notify.test.js tests/worker-mail-actions.test.js`.
Use API doubles and fresh-worker imports to verify restart, failure and race paths;
no actual provider calls from setting changes.
**Dependencies:** None technically; execute after Task 3 for serial delivery.
**Files likely touched:** `src/store/poll-settings.js`,
`src/background/service-worker.js`, `tests/poll-settings.test.js`,
`tests/worker-poll-settings.test.js`.
**Estimated scope:** Medium, four files.

## Checkpoint B: Navigation and scheduling contracts

- [x] `npm run verify` passes; inbox activation and setting changes make no provider writes.
- [x] Worker restart and partial failure tests prove the intended schedule/persistence behavior.
- [x] Inspect native header links in the synthetic browser before adding Settings UI.

## Task 5: Expose check frequency in Settings

**Module**: `check-frequency`
**Description**: Add the retained Mail checking form after Sound, loading the
effective interval and saving through the worker contract.

**Acceptance criteria:**
- [x] Duration/units/Save support the approved range and default, persisted values, no-accounts state and successful reopen.
- [x] Invalid input and failed application show accessible errors; pending Save prevents duplicates and never falsely confirms success.
- [x] Unrelated updates preserve unsaved input/focus; manual Refresh, disabled accounts and theme behavior remain unchanged.

**Verification:** `node --test tests/poll-settings.test.js tests/worker-poll-settings.test.js tests/popup-ui.test.js`;
synthetic form save/reopen, validation, failure and draft-preservation flows.
**Dependencies:** Task 4; Task 3 completed first because popup files overlap.
**Files likely touched:** `src/popup/popup.html`, `src/popup/popup.js`,
`src/popup/popup.css`, `tests/popup-ui.test.js`.
**Estimated scope:** Medium, four files.

## Task 6: Update usage and acceptance instructions

**Module**: All three.
**Description**: Document the resulting current behavior and add candidate-specific
manual checks without editing historical acceptance evidence.

**Acceptance criteria:**
- [x] README explains recoverable deletion without extension Undo, heading navigation and global check frequency.
- [x] Manual checklist covers both-account routing directions, retained recovery, schedule/save failures and manual Refresh.
- [x] The prior action spec records that this approved feature supersedes visible Undo only; provider scope stays unchanged.

**Verification:** Cross-check documentation against all three specs and inspect
links/whitespace with `git diff --check`.
**Dependencies:** Tasks 2, 3 and 5.
**Files likely touched:** `README.md`, `tests/popup-checklist.md`,
`specs/003-mail-cards-actions/spec.md`.
**Estimated scope:** Medium, three files.

## Checkpoint C: Complete candidate

- [x] Node 24 `npm ci`, `npm run verify` and `git diff --check` pass.
- [x] T3 browser batch checks 320px/480px across all three themes, Tab identity and CSS zoom. Focused-host focus rings/native zoom remain pending.
- [x] Run Impeccable detector on changed popup files; address concrete defects in one batch and confirm once.

## Task 7: Align current design records

**Module**: All three.
**Description**: Update current product/design guidance to describe the verified
popup behavior and approved visual treatment, retaining historical records.

**Acceptance criteria:**
- [x] Product/design records describe heading links, removed Undo presentation and the global Settings control.
- [x] Current surface guidance retains account ownership, themes and cache-only operation.
- [x] Design artifacts identify synthetic verification separately from real-account acceptance.

**Verification:** Compare documents with the inspected candidate; check local
links and `git diff --check`. Follow installed Impeccable documentation mechanisms
for metadata it owns rather than hand-inventing generated fields.
**Dependencies:** Checkpoint C.
**Files likely touched:** `PRODUCT.md`, `DESIGN.md`,
`.impeccable/surfaces/src-popup-popup-html.md`, any existing design metadata sidecar.
**Estimated scope:** Medium, up to four files.

## Task 8: Review and record fresh Chrome acceptance

**Module**: All three.
**Description**: Review code/UX against approved scope and record dated acceptance
for the actual unpacked extension candidate.

**Acceptance criteria:**
- [ ] Review finds no unresolved correctness, privacy, accessibility or scope defects. Source review passes; provider routing and focused-host accessibility acceptance pending.
- [ ] Fresh dated results cover unchanged Gmail/Outlook Trash and recovery, correct account inbox selection, and global checking/persistence/manual Refresh.
- [x] Candidate commit, Chrome version and environment are recorded; unperformed checks remain pending and no historical pass is reused.

**Verification:** Apply code-review-and-quality and the project Definition of Done;
owner runs real-account acceptance or uses an explicitly authorized disposable
fixture. Review is not authorization to merge, publish or deploy.
**Dependencies:** Tasks 1–7 and Checkpoint C.
**Files likely touched:** `docs/acceptance/2026-10-02-popup-ux-settings.md`
(use actual acceptance date if later), `specs/004-popup-ux-settings/tasks.md`,
`specs/004-popup-ux-settings/plan.md`.
**Estimated scope:** Medium, three documentation files.

## Final checkpoint

- [ ] Every module success criterion has tests or fresh runtime evidence. Owning-inbox routing/real scheduling still pending.
- [x] Required checks pass and docs match the resulting behavior.
- [x] Real-account acceptance is complete or explicitly pending; no unsupported completion claim.
- [x] Owner reviewed the plan/tasks and authorized `/build auto`, lifting the earlier no-implementation instruction.

Execution evidence: [candidate acceptance](../../docs/acceptance/2026-10-02-popup-ux-settings.md)
and [routing research](research.md). Checked items describe implementation or
synthetic/API-double verification; unchecked items require actual provider/Chrome
acceptance. No merge, push, publish or release was performed.
