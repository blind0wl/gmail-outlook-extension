---
version: 1
work: popup-usability
code: "fix/popup-usability@95650aaddc38d0d79fcb707b29c8143e38636f50 plus dirty: .dev/evidence/popup-usability.md, .dev/project.md, .dev/work.yaml, docs/acceptance/2026-09-30-popup-usability.md"
requirements: "specs/001-popup-usability/spec.md; specs/001-popup-usability/plan.md; .dev/verification.yaml v2"
recorded_at: "2026-09-30T08:42:16Z"
gates:
  automated-tests:
    status: passed
    command: ["npm", "run", "verify"]
    exit_code: 0
    summary: "160 tests, 34 syntax checks and identity validation passed; Node 24.21.0 and Node 26 runs, fresh Node24/26 runs after review R1 recovery repair."
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

## Recovery / next

Initial independent review R1 repaired in appended T012; refreshed review passed.
Owner acceptance on 95650aa is now passed. PR #11 is open with passing CI;
implementation matches the accepted/reviewed candidate. This record update
changes only acceptance/state documentation and the future UI approval preference.
T011 remains open because merge, canonical closeout and independent completion
audit remain pending. Project policy includes merge to main in Definition of
Done; keep this item active until those requirements are fulfilled.
Gmail stale Open remains queued separately. Broader product context capture
with Impeccable init can be considered before a later redesign/new surface.

Post-review changes only record passed T010/review, acceptance phase and selected
project focus. Source/tests/captures match the reviewer-bound candidate; these
metadata transitions do not claim acceptance or completion.
