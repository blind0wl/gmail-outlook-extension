# Gmail follow-ups

Current execution instructions: follow `tasks/plan.md`'s current investigation
contract. Older unchecked write-retest tasks below are historical, superseded by
Gmail Trash containment. Do not act on disputed mail or clear preserved locks.
The owner requested agent-run E2E on 2026-10-01; authenticated disposable test
mail is required before fresh write/Undo acceptance can be completed.

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

## Owner follow-up — five newest unread conversations missing
- [x] Trace cache recovery and identify the default HTTP cache policy in Gmail polling.
- [x] Reproduce a stale feed omitting five recent second-account conversations, then bypass HTTP cache on all poll probes.
- [x] Node 24 verification passes 210 tests; independent review and fresh candidate acceptance record complete.
- [ ] Owner reloads the candidate and confirms whether Refresh restores the five conversations; record Chrome/OS.

The regression models a stale HTTP response. The owner's specific cause and
underlying Trash failure remain unconfirmed.

## Owner follow-up — console evidence unavailable
- [x] Persist the latest 20 content-free outcomes locally, with serial appends and allowlisted records.
- [x] Verify actual provider events, restart retention, concurrency, privacy and storage failures; all 213 tests pass.
- [x] Independent review and fresh acceptance/evidence-capture instructions complete.
- [ ] Owner reloads and captures a new uncertain action's saved diagnostics.

This candidate gathers evidence; it does not change acknowledgement recognition.

## Owner follow-up — searchable mail disappears after Gmail Trash
- [x] Block Gmail Trash at the worker boundary before provider access or state mutation.
- [x] Disable Gmail Trash in the popup with explicit account-level guidance; preserve saved locks.
- [x] RED containment regressions, 215-test verification, synthetic browser and independent review complete.
- [ ] Owner reloads and confirms disabled controls, without any new real-mail write.
- [ ] Diagnose actual provider outcome using preserved evidence; missing mail is not established as permanently deleted.

## Post-merge #16 investigation
- [x] Compare request identifiers and response recognition against the reference client.
- [x] Owner's exact-target link opens the deleted conversation with a restore option.
- [x] Add a diagnostic-only fixed Trash query, positive exact-ID matching and fail-closed parsing.
- [x] Node 24 verification passes 219 tests; independent review and fresh acceptance instructions complete.
- [x] Owner validates the query against one existing lock without further Trash writes: verified-trash, 80 returned.
- [x] Review exact Trash-membership fallback; reject it because mixed-folder conversations can match before a move.
- [ ] Establish trustworthy acknowledgement or complete exact per-message state before implementing confirmation; Trash plus Inbox exclusion does not exclude archived members. Containment remains active.
- [ ] Fresh controlled real-account write/Undo acceptance before restoring Gmail Trash.
- [x] Correct unsupported dynamic import with static worker wiring and a one-line console helper; 222 tests and a real module-worker browser check pass.

## Exact state and Undo candidate — agent investigation
- [x] Reproduce HTTP-success/legacy-ack false negative with approved disposable mail.
- [x] Confirm complete exact conversation membership and labels, failing closed.
- [x] Replace retired HTML Undo with fresh-session modern Sync restore.
- [x] RED regressions, Node 24 verification (253 tests), three real popup cycles and worker-restart Undo.
- [x] Stop extended automation at owner usage request and restore remaining journaled test targets.
- [ ] Owner runs repeated cycles on the clean isolated manual-test candidate.
- [ ] Real multi-member/mixed-folder and second-account acceptance before containment removal.

Evidence: `docs/acceptance/2026-10-01-gmail-exact-state-undo.md`.
