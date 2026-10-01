# Gmail poll freshness — 2026-10-01

Runtime candidate: `e3f0e3e87959cfac5a3e4b0dd353423a4265c7bd` on
`fix/gmail-action-recovery`, draft PR #18. Real-account acceptance: **pending**.
Chrome version, OS and owner's loaded candidate: not yet supplied.

The owner confirmed that the second Gmail account's heading and unread messages
returned after their intermittent absence. Five of its newest unread Inbox
conversations still do not appear in the extension. The owner believes they had
previously attempted Trash on these conversations; the seven-day cutoff does not
explain this report. Neither the intermittent heading failure nor the specific
five-message discrepancy has been reproduced against the real account.

Regular Gmail polling used the default HTTP cache policy even though action
session checks already bypassed caching. This candidate adds `cache: no-store`
to every poll's account-slot feed GET. A Refresh therefore requests a fresh feed
instead of reusing an older browser HTTP snapshot. This closes a freshness gap;
it does not establish that HTTP caching caused the owner's discrepancy. Gmail's
limited feed and the existing seven-day/200-item cache bounds remain in place.
No provider write, automatic replay or recovery acknowledgement behavior changes.

## Fresh verification

- Node 24.21.0: `npm run verify` passed all **210 tests**, none skipped.
- A stale-HTTP-feed regression failed before the fix with one cached conversation
  instead of six. After the fix, polling the second account and reconciling its
  cache restored the five omitted recent conversations. Every slot probe was
  checked for the uncached policy. This is a simulated response, not real Gmail.
- Independent review found no blocker. `git diff --check` passed.
- No new browser UI check was needed for this transport-only change; prior UI
  checks are historical evidence and do not satisfy this candidate's acceptance.

## Real-account acceptance — unchecked

- [ ] Record Chrome version and OS; reload the unpacked repository extension at
  this candidate, then close and reopen the popup.
- [ ] Select All and Refresh. Confirm both Gmail account headings are present.
- [ ] Compare the second account's newest unread Inbox conversations with the
  extension, including the five previously missing conversations. Record whether
  each is restored. Do not share message content or credentials.
- [ ] Retest Gmail Trash beyond three actions in both accounts and verify Inbox
  removal plus Trash presence after refreshing Gmail. Keep #16 open if it fails.
- [ ] If mail remains absent, gather content-free poll/action evidence before
  attributing it to the cache policy. The prior acceptance records describe safe
  action diagnostics; a successful Refresh alone does not prove feed completeness.
