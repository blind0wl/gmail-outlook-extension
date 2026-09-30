# Independent popup completion audit assignment

- Assignment/work: popup-closeout-audit / popup-usability; final T011 lifecycle boundary.
- Base: 253e7a965fb2785d69788d55df533809ff7d82ed; branch chore/popup-closeout.
- Cwd/workspace: /home/dave/dev/gmail-outlook-extension, shared checkout held by root.
- Objective: independently verify requirements, review, owner acceptance, merge and final documentation-only candidate; report required findings or pass with exact checkpoint fingerprint.
- Read spec/plan/tasks/analysis, DESIGN, acceptance, UI evidence, review, project/index/policy and candidate Git diff.
- Write ONLY .dev/evidence/popup-usability-closeout-audit.md. Root owns all other records. No code/spec/index mutation, Git mutation/commit, owner questions, delegation, network/provider/browser/server access. No shared services owned; tests are isolated Node processes with existing dependencies.
- Commands: npm run verify; git diff --check; /home/dave/dev/ai-dev-system/tools/validate closeout .dev/work.yaml --id popup-usability --root /home/dave/dev/gmail-outlook-extension --tasks specs/001-popup-usability/tasks.md; policy-status and adapter-status.
- Policy declares tests + human gate; independent completion audit is additionally required by feature workflow, not a newly introduced policy gate. Canonical closeout can return 0 before report under this existing policy; do not apply template's audit-only failure expectation when no independent-audit policy gate exists.
- Quote exact checkpoint fingerprint; bind normalized content digest, excluding checkpoint/report only as record artifacts and allowing only the pure work.yaml active-to-done transition for popup-usability. All other changes invalidate. Inspect T011 clarification for retained lifecycle requirements.
- Return assignment/base/cwd, commands/exits, verdict/findings, changed paths, no-commit statement, done/failed/blocked/unresolved submission. No worker status authorizes canonical done. Root holds candidate unchanged until return.
