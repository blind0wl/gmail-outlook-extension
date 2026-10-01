# Gmail poll freshness — 2026-10-01

Runtime candidate: `e3f0e3e87959cfac5a3e4b0dd353423a4265c7bd` on
`fix/gmail-action-recovery`, draft PR #18. Five-message discrepancy: **resolved
by refreshing Gmail**. Full candidate acceptance remains pending.
Owner-reported browser: Version 0.18.2.1 (Official Build, Chromium
154.0.8037.92). OS: Arch Linux (x86_64). Loaded commit not independently verified.

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

## Initial owner retest result — 2026-10-01 (superseded below)

After receiving the reload/reopen/All/Refresh instructions, the owner reported:
“The 5 dont return” and supplied the browser and OS above. HTTP cache bypass is
therefore insufficient to resolve this real-account report. Do not treat the
passing simulated regression as acceptance or repeat the same retest unchanged.
At that point the next proposed check was the owning account's Atom feed.

## Owner correction — 2026-10-01

Before performing the feed check, the owner refreshed the second account's Gmail
Inbox and reported that its webpage had been stale. Asked whether the refreshed
Inbox matched the extension, the five conversations had disappeared from Inbox,
and they were present in Trash, the owner answered “yes confirmed”. The five
earlier Trash attempts therefore succeeded; the extension correctly omitted
these conversations from its unread Inbox list. No missing-mail parser/cache bug
is established by this report, and HTTP cache bypass is not established as its
remedy. The prior failed-recovery interpretation is superseded by this evidence.

The repeated unconfirmed-result warnings remain unresolved: successful provider
moves were reported as uncertain. Full fresh repeated-action acceptance in both
accounts remains pending, as does the separate intermittent missing heading.
The owner has supplied the browser/OS, but the loaded commit remains unverified.
