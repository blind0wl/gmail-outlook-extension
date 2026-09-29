---
version: 1
work: extension-v1
code: "028a001 plus dirty: .agents/skills/development-system/SKILL.md, .pi/extensions/development-system-router.ts, AGENTS.md, .specify/, .dev/.onboarded.json, .dev/project.md, .dev/work.yaml, .dev/verification.yaml, package-lock.json, node_modules/"
requirements: "docs/superpowers/specs/2026-09-28-gmail-outlook-extension-design.md, docs/superpowers/plans/2026-09-28-gmail-outlook-extension-v1.md, .dev/verification.yaml v1"
recorded_at: "2026-09-29T12:30:00Z"
gates:
  automated-tests:
    status: passed
    command: ["node", "--test", "tests/"]
    exit_code: 0
    summary: "144 tests passed from project root on 028a001 after npm ci (one initial file-level failure in tests/popup-ui.test.js was missing-linkedom only; resolved by installing devDependency, no code change)."
  human-gate:
    status: passed
    report: "https://github.com/blind0wl/gmail-outlook-extension/pull/1"
    summary: "Squash message records human-accepted (S1-S24 + machine gate) at merge 2026-09-29; owner re-attested working in chat 2026-09-29 during Flow onboarding."
---

# Checkpoint — extension-v1 (onboarding baseline)

Historical completion recorded at onboarding, not through the live lifecycle.
PR #1 squash-merged the full `feat/extension-v1` branch as `028a001`;
branch tip tree verified identical to `origin/main` (empty
`git diff origin/main origin/feat/extension-v1`, 2026-09-29).

## Result and approvals

- Accepted work: local-only MV3 extension — service worker polling, Gmail +
  Graph adapters, cache with local-read flags, badge/toast/chime, A v5 popup,
  per-account error states. Follow-ups deferred to issues #2 and #3.
- Approvals: PR #1 merge (human-accepted S1–S24 + machine gate per squash
  message); owner "working atm" attestation in onboarding chat.
- Checks: exact arguments `node --test tests/`, cwd project root,
  prerequisite `npm ci`, exit 0, 144/144 passed.

## Recovery

- Worker/workspace: onboarding session on `main`; onboarding writes committed in the same commit as this record (see `git log`).
- Last accepted integration: `028a001` on `origin/main`.
- Outstanding gates: none for v1.
- Known discrepancies: `feat/extension-v1` branch un-deleted (delete-or-keep
  pending, see project.md); `node_modules/` present but gitignored.
- Safe next action: pick next work (issue-2 is current focus).

## Discovered work

Issues #2 and #3 mirrored in `.dev/work.yaml` as queued bugs; GitHub owns
their priority.
