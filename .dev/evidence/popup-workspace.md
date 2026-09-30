---
version: 1
work: popup-workspace
code: "docs/popup-design-direction@59e16964978f25d1fe01b96ae631e6155637a690 plus dirty: PRODUCT.md, .dev/project.md, .dev/work.yaml, docs/design/popup-directions/brief.md, docs/design/popup-directions/capabilities.md, docs/design/popup-directions/index.html, docs/design/popup-directions/mailbox-readiness.md, docs/design/popup-directions/preview.css, docs/design/popup-directions/preview.js, docs/design/popup-directions/review.md, docs/design/popup-directions/verification.md, specs/002-popup-workspace/analysis.md, specs/002-popup-workspace/checklists/requirements.md, specs/002-popup-workspace/contracts/popup-workspace.md, specs/002-popup-workspace/data-model.md, specs/002-popup-workspace/plan.md, specs/002-popup-workspace/quickstart.md, specs/002-popup-workspace/research.md, specs/002-popup-workspace/spec.md, specs/002-popup-workspace/tasks.md"
requirements: "specs/002-popup-workspace/spec.md; specs/002-popup-workspace/plan.md approved; tasks.md proposed; .dev/verification.yaml v2"
recorded_at: "2026-09-30T10:44:10.879831Z"
gates:
  automated-tests:
    status: not-run
    summary: "No production implementation yet; first-stage integrated gates must run on its implementation candidate."
  human-gate:
    status: not-run
    summary: "Design preview and written scope approved; owner acceptance of the redesigned extension has not occurred."
---

# Popup workspace specification checkpoint

This session acts on behalf of durable writer dave, continuing the authorized
project work. No other active canonical writer is indicated. No ownership change.

## Approvals and current state

Owner approved the synthetic design preview, all three themes and Midnight desk
default. Owner explicitly selected delivery order popup-workspace → gmail-api →
mailbox-actions; approved individual-message actions, display-only preview and
Trash Undo; then approved the written first-stage specification in a structured
answer round. Technical plan is also explicitly owner-approved. Execution tasks and their
traceability are prepared, with task review pending.

Native Spec Kit specify procedure used its feature-creation/template scripts;
plan used setup-plan.sh with explicit feature directory. Hooks are empty in
.specify/extensions.yml. No native Pi workflow run or production implementation
is claimed. Canonical first-stage spec/plan, quality checklist, data/contract and
verification recipe live under specs/002-popup-workspace/. Native task-template/prerequisite procedures were used after plan approval;
all17 execution tasks are unchecked. Consistency self-assessment is analysis.md. Addy supplies scoped engineering techniques; no duplicate lifecycle.

## Reconciliation

Prior popup-usability is done: PR #11 merged253e7a9, closeout PR #12 merged59e1696.
The stale project-definition wording saying it remained active or that no visual
direction was selected is corrected. Verification policy and writer identity are
unchanged. The queued Gmail stale-Open assessment stays separate.

Existing approved preview files are retained on docs/popup-design-direction.
Transient .impeccable/questions files and ignored .specify/feature.json are local
workflow records, not intended PR content. No provider calls, account changes,
Cloud setup, credential changes, commits, pushes or PR creation in this phase.

## Recovery and next action

Await owner task review before implementation. The native tasks/checklist/analyze
procedures are complete for preparation; implement in thin verified slices after
that review. Tests, independent spec/code/Impeccable finish review, owner
Chromium acceptance and bound closeout/audit remain outstanding for this feature.

Later Google setup/Helium account-selection feasibility and mutation/Undo contracts
are captured in docs/design/popup-directions/mailbox-readiness.md, not guessed into
this stage's provider transport. First-stage Open retains current local mark-read
behavior; preview does not. Later mailbox actions retire legacy flags explicitly.

Fresh planning baseline: `npm run verify` exited0 with34 syntax checks, stable
identity/redirect and160/160 tests. This confirms existing runtime baseline, not
implementation of the approved redesign. Initial index shape validation rejected
non-schema phase/dependency field names; corrected to tasks/depends_on and rerun.

## Implementation start

Owner explicitly approved tasks. Feature branch feat/popup-workspace retains the
approved preparation. Policy-status is current (project/package generation2).
Direction contract written/read through Impeccable surface-brief for src/popup/.
Fresh baseline verify passed160 tests/34syntax/identity. Navigation DOM test failed
for missing Mail/Settings shells before the change, then passed with existing
lifecycle coverage (3 popup tests). Form drafts, pending account controls and
sound workflow coverage remain intact. T001–T004 accepted; feature gates pending.

Per-account grouping test failed with no account sections before implementation;
then passed grouping/order/filter/status, orphan exclusion, preview-only toggle,
existing Open link/local behavior and recovery-to-Settings checks. Old lifecycle
assertions were updated for explicitly approved preview/recovery behavior, keeping
focus and pending-action coverage. T005–T008 accepted; no provider code changed.
