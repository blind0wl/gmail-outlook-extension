# Grouped mailbox recovery — 2026-10-01

Runtime candidate: `7989d70ade1742d2edf4effe2ec59ee46c271151` on
`fix/gmail-action-recovery`, draft PR #18. Real-account acceptance: **pending**.
Chrome version and OS: not yet supplied.

The owner reported 30+ identical unconfirmed-action recovery rows for one Gmail
account on the previous candidate. These were saved action locks, not duplicate
mail cards. The new candidate groups locks per account with a count and one
“I’ve checked” button. Its instructions require checking all listed actions in
the account's mailbox before unlocking them. Undo remains individual.

The button acknowledges only its captured locks through the existing worker
command; it sends no provider mutations. Failed acknowledgements and newly
created locks remain for another explicit check. Duplicate clicks are ignored.
The worker compares the captured timestamp and requires a pending/uncertain
record so recovery cannot clear a newer lock or a completed Trash's Undo.

## Fresh automated/synthetic verification

- Node 24.21.0: `npm run verify` passed **209 tests**, none skipped.
- New tests failed before the relevant fixes: 30-lock grouping, duplicate and
  partial-failure handling, a newer lock after the snapshot, and a matching-time
  pending record that became successful Undo. Existing account isolation holds.
- Independent review caught the pending-to-Undo race; the fix was re-reviewed
  with no remaining blocker. `git diff --check` passed.
- T3 production-file fixture at Midnight 480×600 and Signal 320×600 with a long
  address and 30 synthetic locks: one account recovery row, no horizontal
  overflow, visible button, and clean inspected console. Mouse and keyboard
  acknowledgement cleared all 30 locks using only acknowledgement messages;
  no mailbox writes occurred. Mechanical scan of changed popup: no findings.

## Real-account acceptance — unchecked

- [ ] Record candidate, Chrome version, OS and date after reloading the extension.
- [ ] Existing saved locks collapse to one counted recovery row per account.
- [ ] Check all affected actions in Gmail, then use “I’ve checked”; only that
  account's captured locks disappear. Individual Undo and other accounts remain.
- [ ] Reopen the popup and verify acknowledged locks stay cleared.
- [ ] Retest actual Gmail Trash in both accounts beyond three actions; verify
  Inbox removal and Trash presence after refreshing Gmail. The provider failure
  remains open and is not proven fixed by grouped recovery.

Use the content-free worker diagnostics procedure in
[the prior candidate record](2026-10-01-gmail-action-recovery.md) if a write is
still unconfirmed. Do not share raw provider responses, URLs, cookies or mail.

## Owner follow-up — 2026-10-01

After checking Gmail and acknowledging the saved locks, the owner reported that
the second Gmail account's heading and mail were absent, including after Refresh
with All selected and scrolling to the bottom. A Settings → Accounts screenshot
confirmed that both Gmail accounts remained configured. While preparing a Mail
screenshot, the owner then saw the second account return and confirmed that its
unread messages were also visible again. No intervening action or elapsed time
was established. The loaded candidate, Chrome version and OS remain unconfirmed.

The missing account is therefore intermittent and currently recovered; its cause
is unresolved. Synthetic checks of the current popup retained configured account
headings after acknowledging locks and emptying the cache. This owner report does
not establish successful Trash, explain the temporary absence, or satisfy the
real-account acceptance checks above.
