# Unread expansion stages read — 2026-10-05

## Candidate

Current shared worktree snapshot; implementation is uncommitted. No commit,
PR, or release was created.

## Automated evidence

- `npm ci` completed with Node 24.21.0; 21 packages audited, zero vulnerabilities.
- `npm run verify` completed with Node 24.21.0: syntax checks passed for 59
  JavaScript files, extension identity validation passed, and all 353 tests
  passed.
- `git diff --check` passed.
- DOM coverage exercises mouse and Enter/Space expansion, immediate read style
  and count changes, five-second commit, hover/focus pause, pointer movement out
  after list rerender, another-card click, event bubbling after synchronous
  replacement, Mark unread and Trash cancellation, pending/uncertain locks,
  Open semantics and the accordion's single expanded-card state.

## Real-account Chrome acceptance

**PASS — owner reported 2026-10-05:** “smoke tests passed.” This result applies
to the current expansion/read-grace candidate after the final cleanup and
353-test verification. No implementation changes followed that verification.

The owner accepted the candidate's smoke behavior. The report did not enumerate
accounts, input methods or popup-destruction checks; those individual scenarios
are not separately certified by this record. Automated evidence above remains
synthetic and is separate from this owner-reported result.
