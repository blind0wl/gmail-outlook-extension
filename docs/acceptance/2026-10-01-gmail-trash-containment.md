# Gmail Trash containment — 2026-10-01

Runtime candidate: `c02507327c163061a922d999b3eba0c188f0c372` on
`fix/gmail-action-recovery`, draft PR #18. Owner load verification: **pending**.
Browser reported: Version 0.18.2.1 (Official Build, Chromium 154.0.8037.92),
Arch Linux (x86_64). Prior loaded commit not independently verified.

## Trigger and scope discrepancy

After reporting two conversations missing from Inbox and Trash and failing both
subject and sender searches including `in:anywhere`, the owner searched for a
separate conversation successfully, clicked its Trash action in the extension,
and reported it could no longer be found anywhere in Gmail. This establishes an
owner-reproduced before/after search disappearance. It does not establish the
actual provider labels, permanent deletion, or recoverability. Earlier five/four
moves verified in Trash remain distinct observations, not evidence that the new
attempt succeeded. The approved action scope excludes permanent deletion.

Gmail Trash is therefore unavailable until its behavior is validated. The worker
rejects every Gmail Trash request before token/provider access or journal/cache
mutation; the popup disables the button and explains that Gmail should be used
to manage Trash. This is an explicit temporary discrepancy from the approved
mailbox-action specification, not a claim to have fixed the private transport.
Read, Outlook actions, existing Undo and acknowledgement remain available.
Existing unconfirmed locks and saved diagnostic outcomes remain intact. No
provider mutation, guessed opcode, success-parser relaxation or automatic replay
is introduced. This candidate cannot restore previously affected conversations.

## Fresh verification

- Node 24.21.0: `npm run verify` passed all **215 tests**, none skipped.
- Both new containment tests failed before the guard/UI change. Worker coverage
  verifies repeated requests, no token/mutation access, unchanged cached mail
  and locks, acknowledgement without writes, and continued read/Outlook Trash.
- Gmail concurrency/reconciliation tests now use the still-enabled read action;
  Outlook continues to exercise Trash/Undo and optimistic rollback behavior.
  Historical provider protocol unit tests do not establish real Gmail acceptance.
- T3 production-file fixture at 320×600 with two saved locks: both Gmail accounts
  explain the restriction; every Gmail Trash control is disabled; attempted click
  leaves all four cached cards visible; Outlook Trash remains enabled. No
  horizontal overflow or new inspected console errors. All browser data synthetic.
- Independent review found no containment blocker; `git diff --check` passed.

## Owner confirmation — no new real-mail write test

- [ ] Reload this unpacked extension from `chrome://extensions`, then close and
  reopen the popup. Confirm “Gmail Trash is temporarily unavailable” appears and
  the Gmail Trash buttons cannot be used.
- [ ] Leave the disputed unconfirmed records intact while investigating. Do not
  repeat Trash on real conversations to gather more evidence.
- [ ] Preserve the content-free saved diagnostics using the prior candidate's
  read-only command. No raw provider replies, mail or credentials should be shared.

#16 and the PR remain open/draft. Further diagnosis must use existing evidence or
controlled disposable messages after the transport has been reviewed. Owner
approval of the original scope does not authorize permanent deletion.
