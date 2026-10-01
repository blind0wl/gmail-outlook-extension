# Gmail Trash confirmation review — 2026-10-01

Issue #16, PR #19, branch `fix/gmail-trash-investigation`.
Gmail Trash remains disabled at the worker and popup boundaries.

The owner ran `inspectSavedGmailTrash()` against the first saved uncertain target
on runtime candidate `40358c5`. It returned
`{"ok":true,"status":200,"returned":80,"results":["verified-trash"]}`.
The exact-target link had already shown the deleted conversation with a restore
option. This verifies Trash membership for one saved conversation and validates
that decoder on the real response. It does not validate all saved targets or a
new mutation followed by verification. Owner-reported environment: Version
0.18.2.1 (Official Build, Chromium 154.0.8037.92), Arch Linux (x86_64).

## Review finding and resulting decision

A proposed fallback accepted exact Trash search membership after an unrecognized
mutation reply. Its regression failed before implementation; its mutation/query
integration and the full 226-test suite passed. Independent review then found a
missing behavioral case: an older message in Trash can make a conversation match
while a newer message remains in Inbox. Google documents that search matches
individual messages and may return a whole conversation when any member matches:
https://support.google.com/mail/answer/7190?hl=en

Consequently Trash membership alone cannot establish the intended conversation
move. The proposed fallback, worker wiring, diagnostic enum and its tests were
removed before commit. These passing tests are historical review evidence, not
proof of a shipped confirmation fix. The retained diagnostic still reports only
Trash membership; it changes no locks, cache or provider write policy.

A supported fix requires exact Trash membership plus verified exclusion of the
conversation from Inbox. Absence from the unread Atom feed or first 80 Inbox
search results cannot establish that exclusion. Inbox result completeness or a
supported exact conversation-state lookup must be established first, including
a mixed-folder regression, then fresh real-account write/Undo acceptance. No
new deletion is requested while this remains unresolved.
