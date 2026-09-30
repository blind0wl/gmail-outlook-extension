---
version: 1
work: popup-usability
code: "fix/popup-usability@e94de2ef7b120f173d7b12ed8b16642d94d70fad plus dirty: .dev/evidence/popup-usability-review.md, .dev/evidence/popup-usability.md, .dev/project.md, .dev/work.yaml, DESIGN.md, docs/acceptance/2026-09-30-popup-usability.md, docs/ui-usability/README.md, docs/ui-usability/add-gmail-380.png, docs/ui-usability/error-480.png, docs/ui-usability/long-320.png, docs/ui-usability/populated-380.png, docs/ui-usability/populated-full.png, specs/001-popup-usability/analysis.md, specs/001-popup-usability/checklists/requirements.md, specs/001-popup-usability/plan.md, specs/001-popup-usability/review-assignment.md, specs/001-popup-usability/spec.md, specs/001-popup-usability/tasks.md, src/popup/links.js, src/popup/popup.css, src/popup/popup.html, src/popup/popup.js, tests/popup-links.test.js, tests/popup-ui.test.js, tests/visual/popup-fixture.js"
requirements: "specs/001-popup-usability/spec.md; specs/001-popup-usability/plan.md; .dev/verification.yaml v2"
recorded_at: "2026-09-30T08:34:25Z"
gates:
  automated-tests:
    status: passed
    command: ["npm", "run", "verify"]
    exit_code: 0
    summary: "160 tests, 34 syntax checks and identity validation passed; Node 24.21.0 and Node 26 runs, fresh Node24/26 runs after review R1 recovery repair."
  human-gate:
    status: not-run
    report: "docs/acceptance/2026-09-30-popup-usability.md"
    summary: "Owner real-extension acceptance pending. T3 fixture checks are synthetic, not this human gate."
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

## Recovery / next

Initial independent review R1 repaired in appended T012; refreshed review passed. Open implementation PR for owner acceptance. Owner affected-path checks
must pass before merge; T010 passed; T011 remains open. Do not mark done until
required acceptance, canonical closeout and independent completion audit.
Gmail stale Open remains queued separately. Broader product context capture
with Impeccable init can be considered before a later redesign/new surface.

Post-review changes only record passed T010/review, acceptance phase and selected
project focus. Source/tests/captures match the reviewer-bound candidate; these
metadata transitions do not claim acceptance or completion.
