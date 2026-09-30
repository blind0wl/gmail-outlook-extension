# Fresh-context spec and quality review assignment

- Assignment/work: popup-usability-review / popup-usability.
- Base: main e94de2ef7b120f173d7b12ed8b16642d94d70fad; dirty candidate branch
  fix/popup-usability; cwd /home/dave/dev/gmail-outlook-extension.
- Objective: independent spec-compliance and code-quality review of the
  focused refinement against specs/001-popup-usability/{spec,plan,tasks}.md,
  established DESIGN.md, constitution and project verification policy.
- Cover missing/extra/incorrect scope, correctness, readability, architecture,
  security, performance and meaningful tests. Inspect committed synthetic
  screenshots as the UI-specific finish review; real owner acceptance pending.
- Read repository paths. Write ONLY .dev/evidence/popup-usability-review.md.
  Root owns all other code/docs/index. No browser/server/port ownership.
- No other writes, Git mutations/commits, owner questions, delegation, provider
  auth/network or external app mutations. No canonical .dev state writes.
- Checks: npm run verify; git diff --check. Isolated processes/temp fixtures;
  no shared services. Source/checkpoint content held unchanged during review.
- Return report/native message with assignment/base/cwd, candidate content
  digest excluding your report, changed paths, actual commands/exits/results,
  no-commit statement, findings and state done/failed/blocked/unresolved.
- Required implementation review, not completion audit. Owner browser gate
  and completion/merge cannot be accepted or marked done by the reviewer.
