# Independent review assignment

- Assignment: outlook-deeplink-review; work item outlook-deeplink.
- Base: main 0a78989aaf9031d764c67e131604ec29c0a63efa; candidate is the
  uncommitted repair on fix/outlook-deeplink.
- Objective: review the assessment, full tracked diff and new regression
  test for correctness, simplicity, architecture, security and performance.
- References: assessment.md, fix.md, test.md in this directory; README.md;
  existing v1 design and tests/popup-checklist.md.
- Workspace: /home/dave/dev/gmail-outlook-extension. Read repository files;
  only write .specify/bugs/outlook-deeplink/review.md. No owned service/port.
- Prohibited: code/docs/state modifications, Git mutations, network/browser
  operations, further delegation, owner questions. Return any ambiguity.
- Checks: node --test tests/outlook-deeplink.test.js; read-only diff review.
  Node tests isolate globals in their own process and have no shared ports.
- Return: review.md plus native agent message collected by root. State one
  of running/done/failed/blocked/unresolved with findings, paths, commands,
  exit status, base/candidate identity, and no-commit statement.
- This review is a submission, not project completion or the post-acceptance
  bound closeout audit. Root will inspect the result. Canonical state belongs
  to dave and must remain unchanged.
