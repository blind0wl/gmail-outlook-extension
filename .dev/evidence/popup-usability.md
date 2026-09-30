---
version: 1
work: popup-usability
code: "chore/popup-closeout@253e7a965fb2785d69788d55df533809ff7d82ed plus dirty: .dev/evidence/popup-usability.md, .dev/evidence/popup-usability-audit-assignment.md, .dev/evidence/popup-usability-closeout-audit.md, .dev/project.md, specs/001-popup-usability/analysis.md, specs/001-popup-usability/tasks.md"
requirements: "specs/001-popup-usability/spec.md; specs/001-popup-usability/plan.md; .dev/verification.yaml v2"
recorded_at: "2026-09-30T08:47:24Z"
gates:
  automated-tests:
    status: passed
    command: ["npm", "test"]
    exit_code: 0
    summary: "Fresh merged-candidate npm run verify (includes npm test) passed:160 tests,34 syntax checks,identity validation; Node26. Prior Node24 candidate runs and CI passed."
  human-gate:
    status: passed
    report: "docs/acceptance/2026-09-30-popup-usability.md"
    summary: "Owner reported all affected-path acceptance passed on 95650aa; checked report retained. Browser/version not restated."
  implementation-review:
    status: passed
    report: ".dev/evidence/popup-usability-review.md"
    summary: "Fresh spec/code/UI review passed revised candidate 09a302fd3bb4429acba65048fc92090e016ec596bac146784b8323f7ad051356; R1 resolved."
---

# Popup usability checkpoint

Owner agreed to the focused Impeccable refinement after state cleanup PR #10
merged as e94de2e. This session acts on behalf of durable writer dave; no
other active writer indicated. Scope/specs approved by that agreement; no
material product/design decision added. Native Spec Kit prompt procedures
and setup/prerequisite scripts used; no Pi workflow run is claimed.

## Diagnosis and implementation

Browser baseline confirmed 404px scroll width in a 365px client at 380px
viewport, 24px Sound heading and three nested button structures. Controls
use the existing palette, 13px system type and 32px buttons; headings are
subordinate and account/sound rows wrap. Native summary/Open buttons are
siblings. Focus is preserved by item/account/action/sound keys, form dismissal
returns to launcher and volume percentage updates during input.

Test-first: DOM test failed for missing native summary before repair. A
pending-action test failed after a cache refresh re-enabled the control.
Actual Chromium additionally showed native-disabled replacement dropping
focus to BODY; updated regression failed for absent aria-disabled. Final
focusable aria-disabled control plus repeat guard passed DOM and browser
checks (one request, focus retained, reenables after response).

The old isCardSelfKeydown helper and its test were removed with the manual
role-button key handler. The full suite now has 160 tests instead of 161;
no skipped tests, assertions removed from live behavior or lowered gates.
DOM semantic/focus/volume/pending assertions and native browser Enter/Space
checks replace the obsolete helper-specific coverage.

Review R1 identified the omitted recovery Sign in path. The added DOM
regression failed on refresh focus restoration before repair. Both account
management and recovery now share the pending set and repeat guard. Targeted
Chromium confirms recovery focus, busy reconstruction, one cross-control
request, completion restoration and Add Gmail fallback when recovery vanishes.

## Verification and limits

See docs/ui-usability/README.md for bounded visual/state/geometry/keyboard
results, source hashes and synthetic captures. Installed Impeccable context
allowed incumbent refinement without PRODUCT.md; its one manual detector
returned no findings before the targeted final pending-state/aria correction.
No full screen-reader audit, real provider sign-in, extension sizing or owner
browser pass is invented. Identity, provider URL builders, worker polling,
notifications, credentials and storage schema are unchanged.

## Merged completion candidate

PR #11 is squash-merged as `253e7a965fb2785d69788d55df533809ff7d82ed`.
`git diff --exit-code 0fa1b33 HEAD -- src tests DESIGN.md manifest.json
package.json package-lock.json specs` returned 0 before documentation closeout
edits. Production code exactly matches accepted `95650aa`; `0fa1b33` changed
only acceptance/state documentation and the future UI approval preference.
Fresh npm run verify passed on the merged implementation. Policy generation2
and managed adapter are current. No real-browser acceptance is invented.

T011 now records owner acceptance/merge. Its audit/closeout obligation remains
here as a lifecycle gate, avoiding a self-certifying audit checkbox. This
clarification changes no product requirement or required verification gate.
The completion candidate changes only state/task/evidence documentation.

Fresh audit assignment: `.dev/evidence/popup-usability-audit-assignment.md`.
Audit report: `.dev/evidence/popup-usability-closeout-audit.md`. The writer
must read its candidate-bound verdict and pass canonical pre-commit closeout
before applying only popup-usability's active-to-done transition and committing.
A missing/failed audit or closeout prevents done. This checkpoint is held
unchanged during audit and subsequent binding-inert status transition.

After completion, revisit design choices with owner-approved proposals and
previews before UI edits. No new design implementation is authorized. Gmail
stale Open remains queued separately; do not expand this closeout into it.
