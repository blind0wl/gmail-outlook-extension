# Independent baseline closeout audit

Assignment: `baseline-closeout-review`; work: `outlook-deeplink` and `stable-extension-identity`.
Auditor: `/root/baseline_closeout_review`, independently dispatched fresh scoped review context, distinct from the reconciliation writer. Repository files and checks were inspected independently; the verdict does not rely on root's reported passes. Parent task instructions and later factual messages were available; this is not a claim of zero shared conversation history.
Date: 2026-09-30T07:40:26Z. Cwd: `/home/dave/dev/gmail-outlook-extension`.
Base/current HEAD: `de47eae5fbcf98536cbc0085a254f41e3a3579f2`.
Branch: `chore/reconcile-project-state`; uncommitted state/documentation candidate.
Worker state: **done** (audit submission only). Verdict: **Pass** for the bound candidate. No Critical or Required findings. This does not mark either item or the project done, approve a merge, or replace the writer's final closeout/commit checks.

## Candidate fingerprints

Each exact checkpoint `code` value follows. Both bind the same held candidate:

### outlook-deeplink

```text
chore/reconcile-project-state@de47eae5fbcf98536cbc0085a254f41e3a3579f2 plus dirty: .dev/evidence/baseline-closeout-audit.md, .dev/evidence/merged-baseline-tasks.md, .dev/evidence/outlook-deeplink.md, .dev/evidence/reconciliation-review-assignment.md, .dev/evidence/stable-extension-identity.md, .dev/project.md, .dev/verification.yaml, .dev/work.yaml, .specify/bugs/gmail-stale-open/assessment.md, docs/baseline.md
```

### stable-extension-identity

```text
chore/reconcile-project-state@de47eae5fbcf98536cbc0085a254f41e3a3579f2 plus dirty: .dev/evidence/baseline-closeout-audit.md, .dev/evidence/merged-baseline-tasks.md, .dev/evidence/outlook-deeplink.md, .dev/evidence/reconciliation-review-assignment.md, .dev/evidence/stable-extension-identity.md, .dev/project.md, .dev/verification.yaml, .dev/work.yaml, .specify/bugs/gmail-stale-open/assessment.md, docs/baseline.md
```

## Content freshness binding

Normalized candidate SHA-256: `f1b6ae678428820b4ee580f3f50195d30e365d7181d66b8b8bf2eda47324a188`.
Calculation: sorted union of `git diff --name-only HEAD` and `git ls-files --others --exclude-standard`; exclude only this report; hash each file's bytes with SHA-256; hash the concatenated UTF-8 rows `path + NUL + file_sha256_hex + LF`. Only `.dev/work.yaml` normalization is permitted: convert `status: active` to `status: done` inside exactly the `outlook-deeplink` and `stable-extension-identity` blocks. No other statuses, whitespace, evidence, policy, documentation or implementation bytes are normalized. HEAD supplies unchanged source identity. Any other candidate-content or path change invalidates this report and requires refreshed review/audit. The report's creation and those two consequential transitions are the only exclusions; rerun canonical closeout after them.

Per-file normalized SHA-256:

```text
ff034636becee32e06ef2ad3b4ab6efe30ca92a7836e4b12c4be02d3d33afe2d  .dev/evidence/merged-baseline-tasks.md
7844c2b78acd09a6938100c7f877ec34ba89cdeb04ce3f54ba6b97af7ca43664  .dev/evidence/outlook-deeplink.md
ebdddde308fc137d6782deb51d20b223170d5e5700d10c2b9b1e8c29fe906f87  .dev/evidence/reconciliation-review-assignment.md
2f7684d9c9a27c8fdef9883ef476b686cbaae8ab3e48bf1ec90c3b9c97ff8854  .dev/evidence/stable-extension-identity.md
76c8c27e3afe56137c31e76fb8c9899ae326092cb6b2076c63a66ec90bd0fb87  .dev/project.md
0bba8f23db5f01ca9c34f981111ed849e02d356800ed512ebcbc545dc16b00fe  .dev/verification.yaml
726813cef30b440f6c65906502f18ae38ef18d76ad9c8ee82ab7f2299d64cff4  .dev/work.yaml
a9a85b4a7a55142d28328c97e43db64aabce8e8f4906939abfe9de54cbda692d  .specify/bugs/gmail-stale-open/assessment.md
763f2802e013bd16ebe798308ce5eac55b163dd18078bf9aa0027330e643a1bc  docs/baseline.md

```

## Artifacts read and source equivalence

Read project AGENTS.md, local/package development-system skills, methodology, engineering-skills, reconciliation/state/status contracts, verification-before-completion, applicable Addy code-review-and-quality, audit template, `.dev/.onboarded.json`, project/work/verification records, assignment, merged task sections, both checkpoints and historical issue-2/issue-3 checkpoints. Read both bug assessments, Outlook account-routing assessment/review/test, initial Outlook review, identity review/test, real focused and baseline acceptance reports, human PR/auth/identity procedures, baseline diff, product spec relevant requirements, regression tests, URL resolver, identity CLI, provider/cache webLink handling, package scripts and candidate Git diff.

- Outlook: `git diff --exit-code dfbdda5 HEAD -- src tests/outlook-deeplink.test.js tests/popup-checklist.md` exits 0. Runtime source and affected regression/checklist match final accepted account-routing candidate. Later differences in manifest/package/identity script/test belong to independently accepted identity PR #9. Current resolver/test SHA-256 match the final account-routing review (`5985feb7…`, `e6f5ffc9…`). Final two-account popup owner acceptance is explicitly recorded on `dfbdda5`; initial failures and recovery are preserved rather than relabeled passes.
- Identity: `git diff --exit-code fb18eb92b9f41086927a3210768d53f562e38600 HEAD -- manifest.json package.json scripts/extension-identity.mjs tests/extension-identity.test.js` exits 0. No accepted identity implementation change followed owner acceptance. Focused checks cover browser ID, exact redirect/registration, auth, reload/restart and alternate checkout/profile. The record honestly leaves which alternate-path/profile option unknown; either satisfies that checklist. No new browser test is claimed here.
- Broad baseline smoke is preserved separately with its Outlook exception. Focused dated reports resolve the changed behaviors; historical ticks alone are not reused to accept repairs. Cleanup changes only state/documentation, so it does not require another implementation smoke. The accepted production sources are unchanged by this candidate.
- GitHub read-only inspection: PR #8 MERGED at 2026-09-30T06:32:43Z, `384cd1a366320e6d9bff720511bf1dda0978a758`; PR #9 MERGED at 2026-09-30T07:23:51Z, `de47eae5fbcf98536cbc0085a254f41e3a3579f2`; open issue list is empty. Local/remote-tracking refs contain no `feat/extension-v1`.

## Quality and state review

Correctness: checked task sections reflect the actual repair scope. Graph webLink persists through provider/cache/hydration, rejects unsafe destinations, retains old-cache fallback, and personal account hints preserve message identity. Identity CLI uses strict public SPKI input and the Chromium derivation; tests assert known vectors and fixed deployment identity. Cleanup corrects stale focus/phases and keeps both new repair entries active pending closeout.

Readability/architecture: focused declarative state edits and existing helper boundaries remain clear. No new runtime abstraction, dependency, UI flow or unrelated implementation is introduced. Popup stays cache-only and provider access read-only; per-account isolation remains unchanged.

Security/performance: cleanup introduces no credential/mail-content diagnostics, new permissions, data flow or runtime work. Identity material is public configuration; navigation remains validated at the existing boundary.

Policy: only automated command selection changes from `node --test tests/` to `npm test`, whose current script is `node --test "tests/*.test.js"`. All executable test files are root-level `*.test.js`; visual fixture JavaScript is not a test. Fresh Node 24 run executes all 161 tests with zero skipped/todo. Both required gates, required_for applicability and real-account human procedure are unchanged. YAML `version: 1` remains schema version; policy revision v2 is the documented command correction. This preserves the quality bar rather than bypassing a failed required check.

Writer: durable identity remains dave. Project reconciliation records explicit owner authorization to act on that role; the assignment/root confirm that authorization and no other active writer is indicated. Historical Pi runtime provenance is not treated as ownership. Auditor performs no writer transfer or index mutation.

Gmail: queued low-priority discovery accurately records the owner's transient Inbox display with mail still in Trash; root cause is explicitly plausible, not proven. No repair/test/acceptance/done claim is invented. Unimplemented v1 UI controls remain explicit scope discrepancies rather than silently accepted features.

## Fresh commands and actual results

All commands ran from the stated cwd. Canonical package resolved via `.dev/.onboarded.json`.

| Command | Exit | Actual result |
| --- | --- | --- |
| `PATH=/tmp/node-v24.21.0-linux-x64/bin:$PATH node --version` | 0 | v24.21.0 |
| `PATH=/tmp/node-v24.21.0-linux-x64/bin:$PATH npm test` | 0 | 161 passed; 0 failed/skipped/cancelled/todo |
| `PATH=/tmp/node-v24.21.0-linux-x64/bin:$PATH npm run verify` | 0 | 34 syntax checks, exact identity/redirect validation, 161 tests passed |
| `git diff --check` | 0 | No whitespace errors |
| `/home/dave/dev/ai-dev-system/tools/validate work .dev/work.yaml` | 0 | Structure valid |
| `/home/dave/dev/ai-dev-system/tools/validate verification .dev/verification.yaml` | 0 | Structure valid |
| `/home/dave/dev/ai-dev-system/tools/validate closeout .dev/work.yaml --id outlook-deeplink --root /home/dave/dev/gmail-outlook-extension --tasks '.dev/evidence/merged-baseline-tasks.md::Outlook deeplink'` | 0 | Closeout valid: outlook-deeplink may become done |
| `/home/dave/dev/ai-dev-system/tools/validate closeout .dev/work.yaml --id stable-extension-identity --root /home/dave/dev/gmail-outlook-extension --tasks '.dev/evidence/merged-baseline-tasks.md::Stable extension identity'` | 0 | Closeout valid: stable-extension-identity may become done |
| `/home/dave/dev/ai-dev-system/tools/validate policy-status --root /home/dave/dev/gmail-outlook-extension` | 0 | current; project/package generation 2 |
| `/home/dave/dev/ai-dev-system/tools/validate adapter-status --root /home/dave/dev/gmail-outlook-extension` | 0 | current; all three managed assets current |
| Accepted implementation equivalence commands above | 0 | No affected implementation differences |
| `gh issue list --state open --json number,title`; `gh pr view 8/9 --json number,state,mergedAt,mergeCommit` (each separate invocation) | 0 | Empty open issue list; exact merged repairs confirmed |

The actual policy has no independent-audit gate. Thus the audit template's assumed audit-only nonzero result is inapplicable; both canonical precommit validators correctly exit 0 before report creation. Workflow-required independent audit is supplied here separately without inventing or weakening policy.

Exploratory lookup errors: nonexistent bug `verification.md` paths returned exit 1 (actual records are `test.md` and dated acceptance); attempted standalone `tools/policy-status`/`adapter-status` returned 127 (correct canonical `tools/validate` subcommands above passed); first digest prototype failed an assertion because its block boundary matched fields (corrected to top-level item boundaries and successful digest above). These are not candidate check failures and no pass is inferred from them.

## Findings and result contract

No Critical/Required findings. **FYI:** Outlook checkpoint implementation-review pointer names the initial webLink review. The final account-routing review is independently present and inspected here; it supplies the later helper/test hashes and closes that review coverage gap without treating the initial review as final approval.

Assignment/base/cwd and worker state are above. Changed paths: **only `.dev/evidence/baseline-closeout-audit.md`**. Commits: none. Git mutations, other `.dev` writes, shared-service/browser actions, delegation and owner questions: none. Findings: no blockers; report/evidence path is this file and the inspected checkpoint/review/acceptance paths above. No inaccessible worker or unresolved external side effect encountered. Remaining writer actions: inspect this report and held content digest, rerun closeout against the final candidate, perform only the two planned done transitions after successful closeout, and follow existing commit/merge policy. This audit does not claim the state-cleanup PR is already merged.

Native agent message: `baseline-closeout-review done; Pass for de47eae held cleanup candidate, normalized content digest f1b6ae678428820b4ee580f3f50195d30e365d7181d66b8b8bf2eda47324a188; Node24 npm test/verify and both canonical closeouts exit 0; no blocking findings; only audit report written; no commits; writer retains completion authority.`
