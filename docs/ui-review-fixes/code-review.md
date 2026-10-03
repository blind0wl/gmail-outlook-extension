# Final whole-branch review — review fixes candidate

**Base:** `59ea1c180bfef17f3238e7e59b5ca0dcf03ce458`
**Head:** `7bbd30f0568a8750301f3f468767a3e7a071a8ce`
**Review date:** 2026-10-03
**Review scope:** supplied `review-59ea1c1..7bbd30f.diff`, implementation plan, linked product/poll/action specs, global constraints, progress ledger and task reports.

## Strengths

- Paused-account recovery uses an enabled in-memory record for the immediate poll, stays on the serialized `pollTail`, and commits the enabled flag only after a successful provider result. The recovery commit reloads stored accounts and merges only the target's `enabled` flag, preserving fresh settings and using the fresh list for badge calculation (`src/background/service-worker.js:973-1052`). Generation checks prevent late authentication or provider results from restoring removed/signed-out account state.
- Popup preset state now follows both user edits and every form refill. Initialization order, the document's own `Event` constructor, and the `onFill` callback match the intended draft/pending-save contract (`src/popup/poll-presets.js:2-16`, `src/popup/poll-settings-form.js:5-18`, `src/popup/popup.js:947-966`). The new tests cover asynchronous load, external storage changes, normalization after Save and pending-save conflicts.
- CSS fallbacks are scoped to feature support, while theme selection and keyboard focus remain visible without `:has()`; the native radio controls are retained (`src/popup/popup.css:5-8`, `58-65`, `173-185`; `src/popup/popup.js:909-915`). The recorded forced-fallback browser pass caught and corrected the nested linked-row width issue.
- The unread total has a contextual accessible name, and the Remove tooltip is concise while its provider-mail explanation remains connected through `aria-describedby` (`src/popup/popup.js:202-206`, `270-276`).
- Prototype removal is limited to the authorized documentation copies; active design references point to `src/popup/`. The new acceptance record distinguishes automated/synthetic evidence from live-account acceptance and leaves the latter pending.

## Issues

### Critical (Must Fix)

None found in the reviewed diff.

### Important (Should Fix)

None found in the reviewed diff.

### Minor (Nice to Have)

None found in the reviewed diff.

## Declined to judge

- The contents of deleted `docs/design/polish-v2/`, `docs/design/visual-polish/` and `docs/design/popup-directions/` prototypes were not audited; their removal is the plan-authorized documentation cleanup, and they are not runtime sources.
- Live Gmail/Outlook authentication, provider polling, popup reopen and worker-restart behavior were not judged as passed; no real-account acceptance was available, and the candidate record correctly leaves these checks pending.
- Compatibility in an actual older Chromium release was not judged; the fallback evidence forces support-query branches in modern Chrome and explicitly disclaims older-engine proof.
- Actual Chrome browser-chrome zoom behavior was not judged; the supplied 200% CSS-zoom capture is synthetic evidence only.
- Existing provider mailbox writes, Undo/recovery behavior, notification delivery and sound behavior were not re-reviewed beyond confirming this diff adds no provider write operation or scope expansion; those behaviors are outside this plan's changes.
- Existing Impeccable advisories about documented type/radius tokens were not judged as regressions; the recorded detector output identifies them as pre-existing design/documentation mismatches outside this plan's scope.

## Recommendations

- Keep every item in `docs/acceptance/2026-10-03-review-fixes.md` pending until freshly checked against this candidate with real Gmail/Outlook accounts and the unpacked Chrome extension. Synthetic fixtures and forced CSS branches do not satisfy that acceptance gate.
- If support for older Chromium or true browser zoom becomes a release requirement, add acceptance evidence from those actual environments before claiming compatibility.

## Assessment

**Ready to merge?** Yes, as a code-reviewed candidate; no source fixes are required by this review.

**Acceptance-ready to ship?** No. Fresh real-account Chrome acceptance is still pending, as stated in the candidate record.

**Reasoning:** The live source changes align with the plan and linked contracts, and the recorded Node 24 verification passed 336/336 tests at source commit `19763e9`; the later `7bbd30f` commit adds evidence only. No cross-task correctness or race defect was found in the bounded review. Shipping acceptance remains separate and incomplete until the pending real-account and lifecycle checks are performed.
