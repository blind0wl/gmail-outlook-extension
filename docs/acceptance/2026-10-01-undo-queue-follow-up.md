# Undo queue follow-up — 2026-10-01

## Owner report

After four or five Undos, the toolbar popup displayed “This action is
already queued. Wait for it to finish.” Closing/reopening made it responsive.
All deleted messages were back in Gmail Inbox. The owner subsequently clarified
that only the toolbar popup was open. Successful provider restoration does not
establish the exact cause of the popup/worker feedback problem.

## Reproduced defects and change

Before the change, a regression simulating a missed action-journal storage event
left all fifteen Undo buttons after the first completed restore. Another test
showed a duplicate in-flight Undo returning a queued error immediately rather
than waiting for the original result.

The popup now rereads local action-journal storage after each worker response.
Startup and post-action reads use a revision guard, so a late snapshot cannot
resurrect an entry removed by a newer event. No popup provider access is added.
Duplicate Undo requests share the original worker completion promise; one restore
is sent, and all callers receive the same success or uncertainty result. Other
write types retain duplicate rejection. Durable locks and account checks remain.

## Verification

- Node 24.19.0, npm run verify: 52 syntax checks and 272 tests passed.
- Fifteen sequential and fifteen rapid popup Undos finish without storage events,
  with unique message requests and no remaining tray entries. Further mail actions
  work without reopening the page; local duplicate clicks remain suppressed.
- Late action-state reads cannot replace a newer storage event.
- Duplicate worker Undo waits for the original success; one write occurs. An
  uncertain result is shared, the durable lock remains, and another attempt is
  rejected without replay. Existing write/sign-out/ownership tests still pass.
- T3 browser, synthetic Undo fixture at 320px: twelve Undos complete without any
  action-journal events, twelve unique requests, zero remaining Undo entries,
  “Restored to your inbox.” feedback and mail actions still enabled.
- Independent review reran all five new regressions: passed, no required issues.
- Impeccable detector on changed popup.js: no findings; git diff --check passed.

## Fresh real-account Chrome acceptance — passed for reported batch

Owner result, 2026-10-01, following candidate `4ca2583`:

- Surface: toolbar popup only (owner clarification).
- Twenty messages were moved to Trash successfully. The owner saw progressive
  “Moved to Trash” feedback and described the operations as fairly slow.
- The owner then invoked Undo for all twenty. Undo progressed slowly and the
  displayed count decreased as the operations completed.
- The owner confirmed all twenty messages were back in Gmail Inbox.
- No stuck queued message or sign-in error was reported in this acceptance run.

This is owner-observed real-account acceptance for the twenty-message Gmail
Trash/Undo cycle. It does not establish the precise cause of the earlier failure,
accept Outlook or multiple simultaneous extension views, or measure performance.
The observed slowness remains a usability finding; worker serialization and
per-action ownership/state checks are retained. No speed optimization was made
as part of recording this result.
