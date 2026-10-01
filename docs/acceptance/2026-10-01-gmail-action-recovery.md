# Gmail action recovery candidate — 2026-10-01

Branch: `fix/gmail-action-recovery`, based on `808c91b`.
Candidate code: `b292a45ef33fe3c6fca622e1df4747ad547eb49e`;
documentation-only commits do not change its runtime.
Real-account acceptance: **pending**. Chrome version and OS: not yet supplied.
Related issues: [#16](https://github.com/blind0wl/gmail-outlook-extension/issues/16)
and [#15](https://github.com/blind0wl/gmail-outlook-extension/issues/15).
Superseded for recovery presentation by the
[grouped recovery candidate](2026-10-01-grouped-mail-recovery.md), which has its
own fresh verification and unchecked real-account acceptance.

## Evidence and limits

The owner additionally confirmed on 2026-10-01 that Trash in the second Gmail
account left conversations in Inbox after refreshing Gmail, despite disappearing
extension cards, and that unconfirmed-result warnings kept recurring. This was
reported against the previous candidate, not this branch. No raw provider reply
or session data was collected. The provider failure's root cause remains unknown.

This candidate fixes reproducible cross-conversation acknowledgement contention
and recovery placement. It reads the Gmail action token after uncached session
GETs; tests demonstrate stale-token use under the previous ordering when those
GETs rotate cookies. That does not prove the real-account failure is fixed.
Unknown write replies keep durable uncertainty and never enable Undo. Unread
feed absence remains only inbox evidence, not proof of a successful Trash move.

#15 uses the issue's permitted refresh-guidance fallback after confirmed reads.
No automatic Gmail tab reload or content script is added.

## Automated and synthetic verification

- Node 24.21.0: `npm ci`, `npm run verify` passed **205 tests**, none skipped.
- Regression tests failed before the fixes for acknowledgement contention,
  recovery placement, Gmail read guidance, session-token ordering/uncached reads,
  and diagnostic output. A six-action simulation with the third uncertain
  validates continued actions and a second account without replaying the lock.
- `git diff --check` passed. Impeccable detector on changed popup files: no findings.
- T3 collaborative browser, production popup through the synthetic fixture:
  Midnight at 480×600 and Signal with a long account address at 320×600.
  Recovery appears above mail; only the uncertain card is disabled. An unrelated
  Trash action succeeds and keeps Undo when the first lock is acknowledged.
  Confirmed read clears the card and shows Gmail refresh guidance.
  Keyboard navigation continues after recovery; no horizontal overflow or
  console errors in inspected states. All data and writes are synthetic.
- Independent engineering review found no new correctness/security blocker.
  Its evidence correction was applied: second-account failure and the unproven
  status of the token mitigation are explicit here and in the plan.
- Remaining UX limitation: multiple uncertain rows for the same account have
  generic conversation labels when sanitized journal records omit mail content.

## Real-account retest — start unchecked

- [ ] Record candidate hash, Chrome version, OS and date.
- [ ] Reload the unpacked extension from `chrome://extensions`.
- [ ] Trash more than three conversations in each of two signed-in Gmail accounts.
  Refresh Gmail and verify actual Inbox removal and Trash presence separately
  from disappearing extension cards.
- [ ] If a result is uncertain, verify the mailbox and use “I’ve checked” above
  the mail list. Confirm unrelated conversations and the other account remain
  usable, including when another action is queued.
- [ ] Close/reopen the popup and restart the worker with an uncertain action;
  verify recovery persists and the POST is not automatically repeated.
- [ ] Check Gmail Undo for acknowledged Trash, including conversation-wide scope.
- [ ] Keep Gmail already open, mark read in the extension, confirm immediate
  feedback and refresh guidance, then verify provider read state after refresh.
- [ ] Spot-check Outlook read/Trash/Undo and account isolation.

## Content-free diagnostics for another failed write

Open `chrome://extensions`, find Gmail plus Outlook, and click its **service
worker** link to inspect the worker console. Filter for `gmail-mail-action`.
Keep only those structured lines when reporting a retest. Do not share Network
request URLs/bodies, cookies, raw provider responses or mail content.

Each event includes a random request ID, fixed entry point, read/Trash/Undo
action, browser slot number, HTTP status when available, and outcome. Responses
are classified as `acknowledged`, `sign-in-challenge`, `unrecognized`,
`unreadable` or `request-failed`; the classification never logs the response.
`unreadInboxAbsent` records only complete-feed absence. An `acknowledged` event
records protocol acknowledgement, not independently verified Trash presence.
Events stay in the local worker console; no telemetry service or stored log is
added. Preflight failures before a POST do not emit a write event.
