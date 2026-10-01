# Undo burst confirmation — 2026-10-01

## Owner report

Approximately fifteen messages were deleted and rapidly undone. Extension feedback
said some results could not be confirmed, followed by account-error advice. After
signing in through Settings, the owner found all messages back in Gmail Inbox.
The report does not establish whether sign-in caused restoration or whether Gmail
had already completed the operations while extension verification failed.

## Reproduced defects and candidate mitigation

- An immediate exact-state read can still show Trash after an accepted Undo.
  Before this change the synthetic delayed-state test failed with uncertainty.
  Confirmation now makes up to three reads, with 300ms then 1000ms waits.
- A stale Undo request with no journal record returned `sign-in`; its regression
  test failed before the change. It now returns `undo-expired` without a write.
- Popup advice recommended sign-in for non-authentication failures. Regressions
  for unavailable/provider-error/pending reproduced that misleading advice.
- Session discovery classified 503, 429 and network failure as missing login.
  A failing regression now verifies they return unavailable, while 401 remains
  sign-in. No authentication or ownership checks were weakened.

## Verification

- Node 24.19.0; npm run verify: 52 syntax checks, 267 tests passed.
- Fifteen simultaneous worker Undo requests run through the actual Gmail provider
  with synthetic transport. Every immediate post-write check reports old state;
  every second check reports complete Inbox state. One write reply is lost.
  All fifteen succeed, write exactly once each, remove their journal records,
  and restore fifteen cache items. No provider write is replayed.
- Integration tests cover success on second/third confirmation, persistent mixed
  state limited to three confirmation reads, member targets, ownership changes,
  authorization revocation, lost replies and already-restored mail.
- T3 browser, synthetic Undo fixture at 320px: unavailable response retains Undo,
  reports mailbox-service failure without sign-in advice, no horizontal overflow.
- Impeccable detector on changed popup.js: no findings.

## Fresh real-account Chrome acceptance: pending

Reload the extension and repeat a batch of roughly fifteen deletions and Undos.
Confirm the actual Gmail Inbox and extension feedback agree. If recovery still
appears, check every affected conversation in Gmail before choosing “I’ve checked”.
Do not repeat an uncertain write blindly. Provider write diagnostics remain fixed
fields without content or credentials; use those outcomes to investigate recurrence.

Limits: synthetic delayed state reproduces a plausible cause, not the exact live
incident. Three verification attempts add at most 1.3 seconds of deliberate wait
per delayed Undo, plus existing network timeouts; slower state propagation or
unrecognized private responses still require explicit mailbox recovery. No new
permission, endpoint, write action or automatic replay is introduced.
