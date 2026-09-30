# Independent review assignment: account routing

- Identity: outlook-account-routing-review; work item outlook-deeplink.
- Base: bc7f79c on fix/outlook-deeplink. Candidate: uncommitted account-hint
  repair, with assessment/fix/test reports in this directory.
- Objective: inspect source/test diff plus scoped docs for correctness,
  simplicity, architecture, security, performance; review against owner
  reproduced wrong-browser-mailbox failure and successful hint experiment.
- Cwd/workspace: /home/dave/dev/gmail-outlook-extension; shared read-only
  source tree. Read repository paths. Write only this directory's
  account-routing-review.md. Root owns all other paths; no service ownership.
- Prohibited: other edits, .dev writes, Git mutations, network/browser,
  owner questions, delegation. Return ambiguity/findings to root.
- Checks: node --test tests/outlook-deeplink.test.js; git diff --check.
  Tests use isolated process globals and no shared browser/server state.
- Return via native agent message and review report: assignment/base/candidate
  source hashes, cwd, changed paths, checks/exit results, no commits, findings,
  and one status running/done/failed/blocked/unresolved.
- Fresh context; do not rely on the author’s earlier quality approval.
  This is pre-acceptance review, not the final bound closeout audit. Submission
  requires root inspection and never changes canonical completion state.
