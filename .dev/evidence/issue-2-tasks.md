# issue-2 tasks

Completed steps for the sign-in poll serialization fix. All boxes are checked. No open boxes remain.

- [x] Symptom captured: stale sign-in poll could delete newer mail and re-alert when racing an alarm poll.
- [x] Root cause isolated: `handleSignIn` bypassed the shared `pollTail` chain, and its complete reconcile plus `seenByKey` replace let a stale commit win.
- [x] Regression test written in `tests/signin-serialization.test.js` and observed to fail on pre-fix code.
- [x] Repair applied in `src/background/service-worker.js`: recovery poll chained on `pollTail` with a generation re-check at chain entry.
- [x] Regression test passes post-fix and the full suite passes 145/145 on the merged candidate.
- [x] Human gate pass recorded: PR checklist ticked and PR #4 merged.
