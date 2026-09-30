# Tasks: Focused popup usability

Source: spec.md, plan.md. Serial ownership; native Spec Kit artifacts.

## Phase 1: Specify and baseline

- [x] T001 Record bounded requirements/design authority in spec.md and checklist.
- [x] T002 Capture current overflow, control sizing and semantics evidence.

## Phase 2: Implementation

- [x] T003 [US1] Observe failing semantic/focus regression in tests/popup-ui.test.js.
- [x] T004 [US1] Separate native preview/Open controls in src/popup/popup.js; preserve focus and local read behavior.
- [x] T005 [US2] Restore control/form focus and volume feedback in popup.js with meaningful regression coverage.
- [x] T006 [US3] Normalize controls/type and wrapping widths in popup.html/popup.css.
- [x] T007 [US3] Update DESIGN.md and synthetic long/expanded fixtures.

## Phase 3: Verify and review

- [x] T008 Run npm run verify and bounded browser/state/keyboard/overflow checks; record evidence.
- [x] T009 Run requirements/plan/task convergence; resolve material gaps.
- [x] T010 Obtain fresh spec and quality review; resolve findings.
- [ ] T011 Record owner extension acceptance, required closeout/audit and merge.

## Phase 4: Review convergence repair (appended)

- [x] T012 [US2] Resolve review R1: recovery Sign in focus/pending restoration and shared single-request guard; observe failing DOM regression, then verify repaired DOM and Chromium paths.
