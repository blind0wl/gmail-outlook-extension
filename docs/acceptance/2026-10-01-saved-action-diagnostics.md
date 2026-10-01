# Saved Gmail action diagnostics — 2026-10-01

Runtime candidate: `4def84041efe1ef2299dcf6f63d078aff3437086` on
`fix/gmail-action-recovery`, draft PR #18. Real-account acceptance: **pending**.
Owner-reported browser: Version 0.18.2.1 (Official Build, Chromium
154.0.8037.92), Arch Linux (x86_64). Loaded commit remains unverified.

The owner reproduced four successful Trash moves that the extension labelled
unconfirmed; “I’ve checked” was not pressed. The worker console contained no
events when inspected. Console-only events cannot provide reliable evidence
after a worker restart. This candidate retains the same content-free outcomes in
`chrome.storage.local.mailActionDiagnostics`, bounded to the latest 20 records.
It cannot recover events from actions performed before this candidate was loaded.

The history answers: did a POST receive an acknowledgement, an unreadable reply,
a challenge or another unrecognized reply; what HTTP status and account slot
were involved; and did a complete owning feed establish unread-Inbox absence?
Records contain fixed classifications, a random request ID and numeric timestamp.
They contain no account address, message ID, URL, provider response, mail content
or credentials. Existing records are allowlisted again before retention. Appends
serialize, and storage failure does not alter the action outcome or repeat its
POST. No telemetry service receives the history. Gmail recognition is unchanged.

## Fresh verification

- Node 24.21.0: `npm run verify` passed all **213 tests**, none skipped.
- Tests cover newest-20 retention under concurrent appends, extra-field removal,
  fresh-module recovery, missing/failing storage and actual provider outcomes
  matching the saved history. The diagnostic module tests failed before it existed.
- Independent review found no blocker; `git diff --check` passed.
- Transport/diagnostic-only change; no new browser UI acceptance claimed.

## Real-account evidence capture — unchecked

- [ ] Reload the unpacked repository extension at this candidate and reopen it.
- [ ] The owner has verified the four prior moves in Trash, so “I’ve checked”
  can release those existing locks. It sends no provider writes.
- [ ] On the next owner-approved Trash action, verify its actual mailbox state
  after refreshing Gmail. If unconfirmed, keep the new lock for diagnosis.
- [ ] Open the extension's service worker console and run the read-only command
  below. Paste only its copied JSON history, not Network data or provider replies.
- [ ] Verify the history remains available after reopening the worker console.

```js
copy(JSON.stringify((await chrome.storage.local.get('mailActionDiagnostics')).mailActionDiagnostics ?? [], null, 2))
```

If it returns `[]`, confirm the loaded extension directory/candidate before
repeating writes. To remove the history locally after investigation:

```js
await chrome.storage.local.remove('mailActionDiagnostics')
```

#16 stays open. Successful moves have been verified; their repeated uncertain
classification and the intermittent missing account heading remain unresolved.

## Owner evidence — 2026-10-01

The owner supplied one actual `gmail-mail-action` event: Trash, slot 1,
HTTP 200, outcome uncertain, response unrecognized, unreadInboxAbsent false.
This establishes that a POST received an HTTP-success reply without the expected
acknowledgement. It does not prove the mutation succeeded or failed; the complete
owning-feed absence check also did not establish absence. The console's copy
command returned undefined, which is normal for that clipboard helper; the
copied saved history has not yet been supplied.

The owner then reported two new Trash attempts removed conversations from Inbox
but did not put them in Trash, leaving two unconfirmed locks. This differs from
the earlier five/four verified moves. Fresh Gmail reload and a search of all
locations are needed to establish these conversations' actual labels/unread
state; permanent deletion or archiving is not established by this report.

Read-only comparison against inbasic/ignotifier at
`df220fa2eff2ba48627f72ca9220a0f7aace817b`,
`v3.classic/core/offscreen/gmail/core.js`, uses action code 9 for Trash and code
1 for Archive with the same request structure. This does not prove compatibility
with the owner's current Gmail session. Do not guess another opcode or relax
success recognition on HTTP 200 or unread-feed absence alone.

Reference: https://github.com/inbasic/ignotifier/blob/df220fa2eff2ba48627f72ca9220a0f7aace817b/v3.classic/core/offscreen/gmail/core.js
