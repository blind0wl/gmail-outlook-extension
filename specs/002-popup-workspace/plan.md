# Implementation Plan: Popup workspace

**Branch**: `docs/popup-design-direction` (preparation; implementation will use a feature branch)
**Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)
**Status**: Owner-approved technical plan, 2026-09-30; no production implementation started.

## Summary

Deliver the approved account-based Mail view, dedicated Settings and three themes
using the existing MV3 ES-module popup and worker contracts. First make navigation
and grouping work, then integrate saved themes and verify all states. Provider
write controls ship only in mailbox-actions. Preview becomes display-only now;
Open retains its existing routing and local mark-read behavior in this stage.
The later mailbox-action migration replaces that remaining local behavior.

## Technical Context

- Language: existing vanilla JavaScript ES modules, HTML and CSS; Node >=24.
- Dependencies: existing linkedom devDependency for DOM tests; no new runtime dependency.
- Storage: chrome.storage.local, existing account/mail/status/notification/sound
  keys plus `popupTheme` with one validated theme ID. Credentials untouched.
- Testing: Node test runner; native T3 browser for synthetic layout/interactions;
  owner real-account Chromium acceptance using the repository's checklists.
- Target: compact personal-mail MV3 popup on Chromium, including owner Helium.
- Constraints: 320–480px reflow, 200% zoom, normal-case system font, minimum
  contrast and targets from the approved spec, bounded existing 200-message cache.
- Performance: render cached data without provider/network round trips; theme
  changes update tokens without rebuilding the mail/form DOM.

## Constitution Check

Pre-research and post-design: no unresolved first-stage violation. Local-only
privacy, personal-account scope, provider GET-only transport, credential isolation,
worker ownership, text rendering and existing completion gates remain intact.
The approved preview change stops a popup-triggered local mark-read but does not
erase stored flags or change worker merge rules. The current read-only constitution
must be explicitly amended before later provider-write modules, not silently
reinterpreted now. No manifest/identity or OAuth scope change belongs to this stage.

## Project Structure

- `src/popup/popup.html`: Mail and Settings shells, navigation, existing forms/
  settings controls and labelled theme selector.
- `src/popup/popup.js`: view state, account sections, existing actions and stable
  refresh/focus behavior. Keep unrelated provider/link/worker implementation intact.
- `src/popup/popup.css`: approved structural styles and all three token sets.
- `src/popup/themes.js`: small theme IDs/default/validation/persistence helper;
  no separate generic design framework or settings manager.
- `tests/popup-ui.test.js`: extend actual DOM/Chrome substitute workflows.
- `tests/popup-themes.test.js`: behavior for valid/missing/invalid themes and
  storage errors, not assertions mirroring a palette table.
- `docs/ui-workspace/`: synthetic browser fixture/captures and reproduction note.
- `tests/popup-checklist.md`, `docs/pr-checklist.md`: affected-path acceptance.
- `DESIGN.md` and its Impeccable sidecar: extract from the built approved interface
  at finish; keep historical baseline captures intact.

## Phase 0 — Research and decisions

See research.md. Reuse current account identity and configured ordering. Keep
All/Gmail/Outlook filters above sections. Full addresses wrap; header unread counts
use cached `unread && !localRead`, matching current popup semantics. Prefer native
radio controls for Themes; implement choice as a CSS root attribute update so
focus/form state survives. Unsupported saved values fall back to Midnight.

## Phase 1 — Contracts and data

See data-model.md and contracts/popup-workspace.md. Mail/Settings are exclusive
views, not a modal. Opening Settings remembers Mail scroll/focus; Back restores
Mail and the Settings launcher. A sign-in recovery shortcut opens Settings and
focuses the corresponding account control. Removed targets fall back to a
surviving nearby account control or Add Gmail, rather than leaving focus on body.

Retain the add-account form DOM so storage and theme changes do not wipe drafts.
Account and message controls use stable account/message/action identity for
focus restoration across list updates. Hidden view controls leave the tab order.
State and pending flags update both relevant views; no wholesale popup rerender
on theme selection. Existing status messages remain sanitized and announced.

Theme preference is one independent key. Startup applies a validated stored
choice before exposing the popup content; failures reveal usable Midnight and
appropriate save/read feedback rather than hiding the popup indefinitely. Theme
writes are serialized; rapid changes leave the latest choice stored. A save
failure keeps the selected appearance for this popup and reports it was not saved.

## Verification and delivery

Proposed implementation slices, in order:

1. Mail/Settings navigation with existing controls and stable Back/form focus.
2. Per-account sections and inline states; preview-only expansion and preserved
   provider Open/filter behavior. Cover two same-provider accounts and orphan cache.
3. Theme tokens/selection/persistence, all controls and error/empty/pending states.
4. Narrow/zoom/keyboard review, design extraction, integrated tests, independent
   spec/code/Impeccable finish review, owner real-account acceptance and merge.

Use test-first DOM behavior for navigation, grouping, preview and persistence;
keep existing meaningful coverage and update only assertions whose approved
behavior changed. Full `npm run verify` includes syntax/identity and all tests.
Native T3 captures check all themes and representative states at 320, 380, 404
and 480px and 200% zoom. Only owner Chromium acceptance proves real accounts,
alerts/chime, settings recovery and the actual extension popup dimensions.

Before UI code, persist Impeccable's approved direction contract for `src/popup/`
through its surface-brief mechanism, using the existing concept seed/approved
prototypes; do not reroll the design or run another choice interview. Design
extraction and independent finish review must describe the implemented stage's
Open/preview controls, not the future Trash/read buttons shown in synthetic demos.

Produce a focused implementation PR for popup-workspace. No automatic merge.
Tasks/traceability and consistency analysis follow this approved plan. Gmail
Cloud setup and provider mutation feasibility remain later module prerequisites.

## Risks and mitigation

- Preview no longer creates local read flags: owner-approved change; test worker
  message absence and document it. Open's local behavior remains until later stage.
- Theme-only CSS may miss forms/errors: verify every current component/state in
  each theme, including native controls and clear focus/disabled treatment.
- Storage updates can replace focused controls/drafts: preserve form DOM and test
  cache/account/sound updates while keyboard focus or input is active.
- Real popup size differs from comparison page: synthetic widths/zoom plus owner
  extension acceptance, rather than treating the 620px sample frame as a browser cap.
- Legacy counts are not total-provider counts: keep current cache semantics, and
  specify authoritative mailbox counts with the API migration rather than guess.

## Complexity Tracking

No constitution exceptions or new dependency. One small theme helper is justified
by persistence validation and testable failure behavior; broader refactoring is
outside scope.
