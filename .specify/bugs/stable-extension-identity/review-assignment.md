# Independent review assignment

- Work/assignment: stable-extension-identity / stable-identity-review.
- Base: main 384cd1a366320e6d9bff720511bf1dda0978a758; candidate is uncommitted
  on fix/stable-extension-identity.
- Objective: review the pinned public manifest identity, read-only CLI,
  external redirect/storage contract and tests/docs against assessment.md.
  Cover correctness, simplicity, architecture, security and performance.
- Cwd/workspace: /home/dave/dev/gmail-outlook-extension. Read repository paths.
  Write only .specify/bugs/stable-extension-identity/review.md. Root owns all
  other paths; no owned browser, server, port or external account.
- Prohibited: other edits, .dev writes, Git mutations/commits, browser/network,
  owner questions, or delegation. Return any ambiguity or finding to root.
- Checks: node --test tests/extension-identity.test.js; npm run identity;
  git diff --check. Tests use unique temporary directories with cleanup,
  isolated child processes, no shared services, and no external auth.
- Return report and native agent message: assignment/base/candidate hashes,
  cwd, modified paths, actual commands/exit/results, no-commit statement,
  findings, and one status running/done/failed/blocked/unresolved.
- Fresh context. This is pre-PR implementation review with owner gates
  pending, not a bound completion audit; submission needs root inspection.
