# Gmail follow-ups

## #16 — uncertainty recovery
- [x] Acknowledgement succeeds alongside an unrelated queued mailbox action.
- [x] Recovery is shown before mail, with explicit check/acknowledge guidance.
- [x] Repeated-action tests preserve per-item/account isolation and no replay.

Verification: focused worker/popup tests; synthetic browser recovery/reopen.
Dependencies: existing approved mailbox action implementation.
Likely files: service-worker.js, popup.js, popup.html and their tests.

## #16 — session prerequisites and evidence
- [x] Session checks bypass HTTP cache; the action token is read after them.
- [x] Rotating-cookie regression test passes with one POST only.
- [x] Worker diagnostics classify replies without mail content or credentials.

Verification: focused provider tests, including privacy assertions.
Dependencies: existing session provider; no new scopes or transport endpoints.
Likely files: mail-actions.js and mail-actions.test.js.

## #15 — open Gmail page guidance
- [x] Confirmed Gmail read explains that an open Gmail page may need refreshing.
- [x] Failed actions and Outlook do not receive Gmail success guidance.
- [x] Immediate read feedback remains intact.

Verification: popup DOM tests and synthetic browser read action.
Dependencies: recovery slice, because the same action UI is edited.
Likely files: popup.js and popup-ui.test.js.

## Candidate verification
- [x] Node 24 npm ci / npm run verify and git diff --check pass.
- [x] Browser checks and code review complete; fresh acceptance record exists.
- [ ] Owner tests #16 with real accounts beyond three deletes and explicit recovery.
- [ ] Owner tests #15 with Gmail already open; Chrome/OS/candidate recorded.

## Owner follow-up — repeated recovery rows
- [x] Thirty locks produce one counted row per account and one explicit button.
- [x] Acknowledgement sends no provider mutations and isolates the captured batch.
- [x] Failed/new locks remain; duplicates and completed Undo races are guarded.
- [x] Node 24 verification, browser checks, independent review and fresh acceptance record complete.
- [ ] Owner reloads and confirms grouping/recovery with existing locks.

Verification: popup/worker tests, 480px/320px synthetic browser, fresh acceptance.
Dependencies: existing recovery candidate; underlying provider retest stays open.
Files: popup.js, service-worker.js, their tests and the synthetic fixture.
