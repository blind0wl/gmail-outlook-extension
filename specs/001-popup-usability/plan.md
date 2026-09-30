# Implementation plan: Focused popup usability

Approved scope: spec.md and owner agreement. Base main e94de2e.
Plain MV3 HTML/CSS/JS; no build step or new dependency. Impeccable polish
preserves current ink/white, system font, blue focus and compact mail hierarchy.

## Constitution check

Local-only, text rendering, least privilege, cache-only popup, isolated worker
state and existing identity remain unchanged. Tests plus owner human gate apply.

## Scope and decisions

- US1/FR-003: native summary button inside each list item, with Open as a
  sibling action, replacing role=button around a nested button. Keep original
  cached preview/read action; use native Enter/Space activation. Remove the
  now-unused card-key helper and its mirror tests when replaced.
- US2/FR-004/006: group account label/actions, restore surviving controls by
  provider/account/action or sound key, return focus to Add launcher, update
  volume percentage while input changes, persist on existing change event.
- US3/FR-001/002/005: border-box popup capped by available width, consistent
  13px controls and subordinate headings, wrapping flex groups and labels,
  32px buttons, shared focus/hover/disabled treatments and native inputs.
- src/popup/{popup.html,popup.css,popup.js}, optional links.js dead helper;
  tests/popup-ui.test.js and popup-links.test.js; tests/visual/popup-fixture.js
  only to make expanded fixture activate the native summary and add long data.
- DESIGN.md updates describe resulting values; prior captures remain history.

## Verification

Meaningful failing DOM regression for semantics/focus before behavior edits.
CSS is validated in browser, not through implementation-mirroring unit tests.
Fresh npm run verify; real T3 browser fixture at 320/380/404/480 and short-height
scrolling, empty/populated/expanded/error/sign-in/form states, long text,
keyboard preview/Open/filter/sound/form, computed overflow/focus/state checks.
Impeccable detector once after build. Bounded inspection and one confirmation
round. Independent spec/quality review and owner extension acceptance before
merge; do not mark done until canonical closeout and completion audit.

## Execution

Serial implementation; root owns all code. Fresh reviewer later owns only
assigned review report, no browser or state. Specs populated using installed
Spec Kit prompt procedures/scripts; no native Pi command execution claimed.
