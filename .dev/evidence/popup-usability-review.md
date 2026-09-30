# Popup usability — independent implementation review

Date: 2026-09-30. Assignment: `popup-usability-review` / `popup-usability`.
Cwd: `/home/dave/dev/gmail-outlook-extension`.
Base: `e94de2ef7b120f173d7b12ed8b16642d94d70fad` (`main`).
Candidate: dirty `fix/popup-usability`, held unchanged by root during review.

**Current verdict: implementation review passed after R1 repair. No unresolved
required findings.** Initial review requested changes; that history is retained
below. This is an implementation review, not a
completion audit, merge approval, or authorization to mark the feature done.
Owner real-extension acceptance is explicitly not run and remains required.

## Candidate identity and scope

Candidate content digest, excluding this report:
`09a302fd3bb4429acba65048fc92090e016ec596bac146784b8323f7ad051356`.
Initial reviewed candidate digest:
`ff81ff1adae287fbd5c9877f422cce2d8c0e971c4ed0f3310104401961bfdebe`.
Algorithm: collect `git ls-files -c -o --exclude-standard -z`, exclude
`.dev/evidence/popup-usability-review.md`, sort unique paths, retain existing
files, SHA-256 each file's bytes, serialize `[path, hash]` pairs using Python
`json.dumps(rows, separators=(',', ':'))`, then SHA-256 that UTF-8 string.
168 files contribute, including unchanged tracked source and all untracked
candidate artifacts; ignored dependencies and temporary tools do not.

Changed tracked paths: `.dev/project.md`, `.dev/work.yaml`, `DESIGN.md`,
`src/popup/links.js`, `src/popup/popup.css`, `src/popup/popup.html`,
`src/popup/popup.js`, `tests/popup-links.test.js`, `tests/popup-ui.test.js`,
`tests/visual/popup-fixture.js`.

New candidate paths: `.dev/evidence/popup-usability.md`,
`docs/acceptance/2026-09-30-popup-usability.md`, `docs/ui-usability/README.md`,
`docs/ui-usability/{add-gmail-380,error-480,long-320,populated-380,populated-full}.png`,
`specs/001-popup-usability/{analysis,plan,review-assignment,spec,tasks}.md`,
`specs/001-popup-usability/checklists/requirements.md`.

Reviewed spec, plan, tasks, convergence assessment, requirements checklist,
constitution, project definition/index/verification policy, incumbent DESIGN,
actual source/test diff and surrounding render/event code, synthetic fixture,
captured PNGs and their README, checkpoint and pending acceptance artifact.
Applied development-system first, scoped Addy code-review-and-quality and
frontend-ui-engineering guidance, Impeccable critique/audit/Operate guidance,
and fresh verification-before-completion guidance. The Impeccable launcher
and detector were not run by this reviewer under the assignment's write and
network restrictions; incumbent context and captured visuals were read directly.

## Initial required finding — resolved on refreshed review

**R1 — Preserve recovery Sign in focus and pending state through refresh.**
Severity: required / P1, incorrect and missing FR-004 behavior.
Location: `src/popup/popup.js:373` (`renderStatus`), especially lines 377 and
391–405; cache refresh calls `render()` and thus this renderer, while account
state/account changes also rebuild it directly.

For an account with `needsSignIn`, focus the `.status-signin` recovery button,
then deliver an unrelated `mailCache` storage change while the account still
requires sign-in. `renderStatus` removes the focused button and creates its
replacement without recording/restoring its account/action identity. The
surviving account control loses keyboard focus. If the recovery operation is
pending, a refresh also replaces the disabled “Signing in…” button with an
enabled “Sign in” button, allowing repeat activation. These are the same focus
and pending reconstruction problems addressed for `#account-controls`, but
the separate recovery path is omitted.

Confirmed in an isolated, in-memory linkedom reproduction using the production
popup module, synthetic accounts/accountState, captured storage listener and
an activeElement shim that returns BODY when the focused element is detached:

```json
{"beforeConnected":false,"afterFocus":"BODY","recoverySurvives":true,"restored":false}
{"pendingButtonDisabled":true,"replacementDisabled":false,"replacementText":"Sign in"}
```

This establishes removal and absent focus restoration/pending state in source
and DOM. It is not a claim of a new real-browser or real-account check. The
root's prior Chromium evidence already records why native-disabled replacement
is insufficient for surviving account-control focus.

Fix: key recovery controls by provider/account/action, preserve focus while
that recovery control survives, and retain pending sign-in state independently
of the DOM with a repeat-activation guard. Reuse the account-action policy
where practical rather than maintaining two incompatible pending mechanisms.
Add meaningful regression coverage for recovery focus on cache/accountState
refresh and pending recovery reconstruction, including single-request behavior.
If successful recovery removes the control, use a deliberate surviving focus
destination. Retest that path in the synthetic browser and update its affected
evidence and convergence claims.

## Initial spec compliance assessment

- FR-001: palette, provider/read identity, content and action order are
  preserved; moving Open to a sibling retains its logical position.
- FR-002/005: shared typography, wrapping actions/labels, 32px buttons,
  focus/hover/disabled states, and narrow border-box sizing are implemented.
  Summary button's explicit zero minimum is backed by its visible content
  height. Native inputs retain their behavior with larger label hit areas.
- FR-003: preview/Open are sibling native buttons, meaningfully named;
  preview expansion is exposed via aria-expanded/aria-controls. Local read
  and existing safe provider-link builders remain unchanged.
- FR-004: message summary/Open restoration, account-management restoration,
  chime restoration and form launcher restoration are implemented. Recovery
  Sign in remains incomplete (R1).
- FR-006: input-time visible/spoken volume percentage and existing change-time
  persistence are preserved.
- FR-007: no changes to provider fetch/auth, worker polling/notifications,
  storage schema, manifest identity, or dependencies. Popup stays cache-only.
- Extra scope: no unrequested product capability found. Metadata, focus
  fallback, ARIA names and fixture extensions serve the approved refinement.
- SC-001 and the claim in `analysis.md` that all buildable requirements are met
  cannot be accepted until R1 is resolved. T010 is correctly still unticked;
  T011 and the human gate remain open. Saved convergence evidence is too broad
  given the omitted recovery path and must be reconciled after correction.

## Initial quality axes and tests

Correctness: request changes for R1; the remaining reviewed flows match scope.
Readability: explicit account/message/sound identities are understandable;
native buttons remove manual keyboard logic rather than relocate it.
Architecture: no new framework, dependency or provider ownership drift; the
recovery path should share the established pending policy to close R1.
Security: mail remains textContent, links retain the existing safe builders,
diagnostics/credentials are unaffected, and fixture content is synthetic.
Performance: no new fetching or unbounded work; existing bounded cache renders
remain, with lightweight focus lookups and no animation/layout-read loops.

The removal of `isCardSelfKeydown` and its single mirror test is justified:
the role-button/card keydown listener and import are gone, so the helper has
no remaining production use. Keeping that test would verify dead behavior.
The expanded DOM test exercises real summary semantics, expansion/read messaging,
focus after refresh, chime settings restoration, volume feedback, form return,
and pending account-action single activation. It is meaningful replacement
coverage, with native Enter/Space evidence supplied separately by the root's
browser checks. No live assertion weakening, skips, new dependency, or lowered
gate was found. The test focus shim cannot prove browser focus behavior or
native key activation; those limits are correctly separated in the evidence.
Its missing recovery scenario explains why the green suite does not catch R1.

## UI finish review and evidence limits

Viewed all five new PNGs. Typical/full captures retain the compact, flat
system-font identity, ink primary states and provider treatment. Account
groups wrap, the 320px capture wraps long addresses, the add form has a clear
visible focus ring, and the full capture shows Sound subordinate to Inbox,
aligned sound rows and volume feedback. No new visual finish defect requiring
a change was found in the displayed areas. Native vertical scrolling remains
visible and no clipped action was visible in these captures.

The 600px long/error captures show only their upper scrolled portion, so they
alone cannot prove expanded text or error rows below the fold; source wrapping
rules and the root's documented geometry/state checks supply that additional
evidence. Captures are synthetic and were not recaptured by this reviewer.
No screen-reader certification, extension window sizing, real provider/auth,
notification or owner acceptance is inferred from them. Current policy and
the acceptance note correctly keep owner Chrome acceptance pending.

## Executed checks and disposition

- `npm run verify` on default Node `v26.10.0`: exit 0; 34 JS syntax checks,
  extension identity validation, 160 tests passed, 0 failed/skipped/todo.
- `PATH=/tmp/node-v24.21.0-linux-x64/bin:$PATH npm run verify` on installed
  project baseline Node 24.21.0: exit 0; same syntax/identity checks and all
  160 tests passed, 0 failed/skipped/todo.
- `git diff --check`: exit 0, no whitespace findings (run independently after
  the initial suite as well as during inspection).
- Isolated `node --input-type=module` heredoc reproduction for recovery focus
  and pending reconstruction: exit 0, results recorded above. No fixture file
  or candidate source was written.

No commit, staging, branch mutation, provider/network/browser/server access,
canonical state write, owner question or delegation occurred. Only this report
was written. Dependencies already existed; npm ci was not rerun because this
assignment prohibits other writes/network and changes no dependencies.

Initial state: **review done; required finding unresolved; implementation-review
failed**. The refreshed disposition below supersedes this initial state.

## Refreshed affected review — R1 resolved

Reviewed revised `popup.js` and complete DOM regression, appended T012,
reconciled convergence analysis/checkpoint and browser README. Candidate was
held unchanged during final inspection after root removed six accidental unused
recovery-focus declarations from `renderList`/`renderSound`. Those declarations
were identified during refreshed review and are absent from the final candidate.
This cleanup introduces no behavior change.

`renderStatus` now captures the focused recovery account, restores its surviving
button, and focuses Add Gmail if that control vanishes. Recovery buttons expose
their action/account identities, use focusable aria-disabled state, and reconstruct
“Signing in…” from the shared `pendingAccountActions` set. `sendAction` updates
both account and recovery controls at start/completion, so sign-in through either
location blocks repeated requests through both. The recovery wrapper checks
pending state before awaiting the action and reloading status, preventing a
duplicate click from triggering a premature status load. Existing worker runtime
message payloads and ownership are preserved; promise-based messaging matches
the existing account-management path.

The regression checks recovery focus through cache refresh and pending
accountState refresh, pending text/ARIA, exactly one sign-in across both control
locations, focus/reenabling after completion, and removal fallback. Root reports
the new regression failed before the repair; reviewer freshly ran it within the
full suite. Root's dated synthetic Chromium evidence confirms the same affected
paths; reviewer did not independently run a browser. No style changes require
new visual captures, and the prior captured finish assessment remains applicable.

R1 is resolved. Current FR-004 compliance includes recovery controls. No remaining
missing, extra or incorrect buildable scope, correctness, readability,
architecture, security, performance or meaningful-test blocker was found.
The convergence assessment acknowledges the initial omission and appended T012;
T010/T011 remain open pending writer reconciliation and owner gates. The obsolete
helper/test removal remains justified and no gate/test-quality reduction occurred.

Fresh refreshed checks:

- `PATH=/tmp/node-v24.21.0-linux-x64/bin:$PATH npm run verify`: exit 0 after
  final dead-declaration cleanup; 34 syntax checks, identity validation, all
  160 tests passed, 0 failed/skipped/todo.
- `npm run verify` on Node 26.10.0: exit 0 after functional repair and before
  the six unused-declaration removals; same 160 tests/34 checks/identity passed.
  Final candidate is bound by the baseline Node 24 run above.
- `git diff --check`: exit 0 on the final held candidate.
- Candidate digest recomputed on the final candidate, excluding this report;
  168 files, algorithm and digest given above.

Current state: **review done; R1 resolved; implementation-review passed**.
Only this report was written by reviewer; no commits or canonical-state edits.
Owner real-extension acceptance is still not run. Required human gate, canonical
closeout, independent completion audit and merge remain pending; this review
does not authorize a feature completion claim or merge before those gates.
