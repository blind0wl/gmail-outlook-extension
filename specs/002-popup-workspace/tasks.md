# Tasks: Popup workspace

Input: approved spec.md and plan.md, research.md, data-model.md and contracts/.
Status: implementation and independent reviews complete, 2026-09-30; PR preparation and owner acceptance are recorded under T017. Owner-approved execution tasks. Checkboxes record accepted
increments; feature completion still requires the declared gates. Requirements checklist completion is not implementation progress.

## Phase 1 — Setup and foundation

- [x] T001 Prepare a feature branch preserving approved preparation files; persist the Impeccable direction contract for src/popup/ via surface-brief, and run fresh `npm run verify` baseline. Inspect explicit intended paths; exclude .impeccable/questions and local workflow records. Record implementation verification in docs/ui-workspace/. No new design interview or global tooling changes.

No new framework, dependency, authentication or provider setup prerequisite.

## Phase 2 — US2: Separate Settings (P1)

Goal: move existing configuration out of Mail while retaining real operations.

- [x] T002 [US2] Write failing DOM tests in tests/popup-ui.test.js for exclusive views, Mail scroll/Back focus, existing account operations and unsent form input across storage updates. Verify with `node --test tests/popup-ui.test.js`. Covers FR-003/004/007, SC-002.
- [x] T003 [US2] Implement Mail/Settings shells and view state in src/popup/popup.html, popup.js and popup.css, retaining existing form/sound/alert controls and real worker messages. Back restores Mail position and focus; hidden views leave tab order. Depends T002; focused test must pass.
- [x] T004 [US2] Cover and preserve add/cancel focus, duplicate-action prevention, failure feedback, removed-account focus fallback and sound/volume/focused-provider preference persistence in tests/popup-ui.test.js and src/popup/popup.js. Depends T003; run `npm test` checkpoint.

Independent test: manage a synthetic account and sound exclusively in Settings,
then Back to Mail without losing scroll, focus or pending state.

## Phase 3 — US1: Per-account mail (P1)

Goal: separate each configured account without changing links or provider transport.

- [x] T005 [US1] Write failing DOM cases in tests/popup-ui.test.js: two Gmail plus Outlook groups, stable configured order/newest-first messages, provider filters, empty/disabled/stale/signed-out accounts and excluded orphan cache. Covers FR-001/002/003, SC-001.
- [x] T006 [US1] Implement section headers, full addresses, cached unread counts and matching mail lists in src/popup/popup.js and popup.css; integrate existing status feedback and recovery-to-Settings focus. Depends T005 and T004; focused test passes.
- [x] T007 [US1] Write/update meaningful preview/Open behavior tests in tests/popup-ui.test.js, then make preview expand/collapse without mark-read in src/popup/popup.js. Keep existing Open route and local mark-read; retain stable message/action focus across refresh. Covers FR-005/007/010. Depends T006; test worker request absence for preview and correct account-specific Open.
- [x] T008 [US1] Verify long/missing metadata, live cache/account updates and focused/expanded-message removal using tests/popup-ui.test.js and src/popup/popup.js. Adopt a defined surviving-control focus fallback. Depends T007; run `npm test` checkpoint.

Independent test: identify 2/1/1 sample messages under three accounts, filter,
preview without a read mutation, Open the exact account link and recover sign-in
through Settings. No server-write icons are exposed in this stage.

## Phase 4 — US3: Persisted themes (P2)

Goal: approved appearance choices apply consistently and survive reopen/reload.

- [x] T009 [US3] Write failing persistence tests in tests/popup-themes.test.js for valid/missing/invalid IDs, failed reads/writes and rapid serialized choices. Covers FR-006/009, SC-003. Verify with `node --test tests/popup-themes.test.js`.
- [x] T010 [US3] Add src/popup/themes.js validation/load/save and integrate root theme application plus Settings native radios in popup.js, popup.html and popup.css. Copy corrected approved palette roles, use Midnight fallback, show sanitized save error and serialize preference writes. Depends T009/T004; focused tests pass.
- [x] T011 [US3] Extend tests/popup-ui.test.js for immediate palette choice, unchanged focused radio/form input/expanded mail, storage updates and reopen. Adjust popup.js only for failed cases. Covers FR-006/007/009 and SC-003; no full popup rerender solely to apply a theme. Depends T010.
- [x] T012 [US3] Complete all existing component/state styling in src/popup/popup.css and popup.html: normal-case system text, pending/error/empty forms, native control contrast and focus/target sizes in each theme. Preserve keyboard semantics and wrap. Depends T011; run `npm run verify` checkpoint.

Independent test: keyboard-select each theme, reopen/reload, simulate storage
failure and use every Settings section without a focus/draft reset.

## Phase 5 — Cross-cutting verification and delivery

- [x] T013 Build a synthetic browser fixture and reproduction note in docs/ui-workspace/; inspect each theme and empty/error/long states through native T3 at 320, 380, 404 and 480px plus emulated 200% layout zoom (actual browser zoom remains T017 acceptance), including keyboard navigation/radio arrows, overflow, contrast and focus. Save inspected captures and evidence; use no real mail. Covers FR-007/008, SC-004. Depends T012.
- [x] T014 Obtain fresh independent spec/code and Impeccable finish reviews bound to the integrated candidate and approved direction contract; record reports under docs/ui-workspace/. Repair material findings and rerun affected checks/reviews before acceptance. Covers FR-010, SC-005. Depends T013.
- [x] T015 Extract the implemented design through Impeccable's finish documentation workflow into DESIGN.md/sidecar; update README.md, tests/popup-checklist.md and docs/pr-checklist.md for the actual stage. Keep historical baseline/proposal provenance, describe preview-only plus existing Open behavior, and exclude future action buttons. Refresh affected review evidence if documentation reveals a mismatch. Depends T014.
- [x] T016 Run final `npm run verify` and curate explicit intended changes; preserve tests, stable extension ID and no provider/scope changes. Inspect complete diff, update docs/ui-workspace/ with actual results and current source hashes. No old test/preview pass substitutes. Depends T015.
- [ ] T017 Prepare the focused implementation PR and register its URL with T3; ask owner for affected-path real-account Chromium acceptance on the exact verified revision, recording browser/revision in docs/acceptance/. No automatic merge. Covers SC-001–SC-005. Depends T016.
Completion after T017: record owner acceptance against the tested revision and merge through the reviewed PR. Addy and Impeccable govern review and verification; the retired ai-dev-system closeout/index policy no longer applies.

## Dependencies and execution order

T001 → T002–T004 → T005–T008 → T009–T012 → T013–T017 and owner acceptance. Each
behavior slice uses red/green verification before its checkpoint. US2 runs first
because both other stories share navigation/form preservation; each completed
story can be demonstrated independently on the same existing provider reads.

Serial implementation is deliberate: story tasks share popup.js and popup.css.
No parallel code workers or same-file assignments. Independent read-only spec and
quality reviews may run concurrently when the required harness contracts are
loaded and independence is established; this plan does not dispatch workers.

## Requirements coverage

| Requirement | Tasks |
| --- | --- |
| FR-001/002 | T005/006/008/013 |
| FR-003/004 | T002–004/006/013/017 |
| FR-005 | T007/008/017 |
| FR-006 | T009–012/013/017 |
| FR-007 | T002–004/007/008/011–014 |
| FR-008 | T012/013/014 |
| FR-009/010 | T001/009–011/014/016 |
| SC-001 | T005–008/017 |
| SC-002 | T002–004/013/017 |
| SC-003 | T009–011/013/017 |
| SC-004 | T012–014/017 |
| SC-005 | T014–017 and owner acceptance |

## Implementation strategy

Ship one focused popup-workspace PR; use reviewed, tested commits for navigation,
account sections and themes within it. Keep provider writes and Google setup in
their later approved modules. The owner approved implementation in this session.
