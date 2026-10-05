# Expansion marks mail read — 2026-10-05

Goal: expanding an unread email displays it as read, with time to Trash it
before dismissal. Authorized by the owner's request in this thread.

## Acceptance contract

- Mouse click or Enter/Space expansion stages the existing reversible read
  interaction: read styling and unread counts update immediately.
- Keep the expanded card and its Trash control available while hovered or
  keyboard focused. After leaving, dismiss after five seconds; an outside
  click (including another card) commits immediately.
- Reuse the existing deferred worker/provider read write, local cancellation
  via Mark unread, Trash cancellation, account isolation and error recovery.
- Collapsing does not mark unread. Re-expanding an already staged card must
  not cancel its read. Locked/uncertain mailbox actions must not stage writes.
- Preserve cache-only popup, accordion, keyboard controls, themes and Open.

This deliberately supersedes the older display-only expansion requirement;
provider Open keeps its separate local-read semantics. Mailbox reads are staged
until dismissal, consistent with the owner-approved 2026-10-02 grace period.

## Plan and evidence

Bounded change: connect expansion to stageRead, guard locked actions, cover
expansion/Trash/timer/keyboard/accordion/re-render behavior with DOM tests,
run Node 24 npm ci and npm run verify, then review a fixed candidate.
Separate plan/spec review omitted: existing read protocol, no auth changes.
Fresh real-account Chrome acceptance must be recorded separately and remains
pending until the owner exercises this candidate.

Base: `3241e985dde728ebdb5258c10439b0454f3015a2`.
Initial working tree: clean. ARCHI.md accurately identifies existing seams.
Invocation overrides authorized by owner: Sol for orchestration; Luna with
maximum reasoning for implementation. T3 catalog exposes codex_proxy /
gpt-6-luna with reasoningEffort=max. Other in-thread roles use current Sol;
review independence will be disclosed. Global implementer policy was unavailable.
AGENTS.md has an owner change made between turns; preserve it outside this task.

## Final candidate and review

Implemented by codex_proxy / gpt-6-luna, reasoningEffort=max. Sol performed
verification, acceptance/code review and closeout in this context (invocation
override current model). Two in-thread review passes have reduced independence;
no independent reviewer verdict is claimed.

Final frozen WIP review package: `/tmp/expand-read-review-final`, manifest SHA256
`78108fb3eb5c441094bd2b156f2e62ae778f811e475ab3ce6afe9084820c7d4d`.
Hashes checked before both passes; reviewed implementation matches worktree.
Source package includes source, tests, spec, task contract, AGENTS/ARCHI context
and verification log. One cleanup round removed redundant pointer tracking;
existing hover reconciliation handles the expansion rerender without new state.

Evidence: Luna ran Node 24.21.0 `npm ci`; Sol reran `npm run verify` under
Node 24.21.0 after cleanup: 59 JS syntax checks, identity check, 353 tests passed,
zero failures/skips. `git diff --check` passed. Impeccable detector reported `[]`
for popup.js; appearance and tokens unchanged. DOM cases cover the acceptance
contract, including read styling/count, keyboard, timer boundary, hover/focus,
rerender, cancellation/Trash, other-card commit and locked-action guards.

Spec/acceptance verdict: automated contract satisfied; owner reported smoke
tests passed on 2026-10-05. Standards verdict: **pass**, no blocking code
findings in final snapshot. Provider mutations use the existing worker protocol;
popup has no new provider calls. Product/spec add dated superseding requirements;
architecture/commands are unchanged, so no ARCHI refresh needed.

Status: delivered in the worktree, owner smoke acceptance recorded in
docs/acceptance/2026-10-05-expand-marks-read.md. The owner did not enumerate
individual scenarios; no exhaustive per-account/lifecycle coverage is claimed.
No further implementation or acceptance action remains for this request.
User-owned AGENTS.md changes preserved. No commit, PR, merge or release made.
