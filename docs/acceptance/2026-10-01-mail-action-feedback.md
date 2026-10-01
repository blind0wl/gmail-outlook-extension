# Mail action feedback correction — 2026-10-01

Candidate: feature/mail-cards-actions, follow-up to fd60470.
Real-account retest of this candidate: **pending**.

Owner observation on the prior candidate: Gmail Trash removed mail from Gmail
but left its extension card. Gmail mark-read worked but popup feedback lagged.
This establishes provider writes worked for the tested conversations; it does
not establish compatibility for every account or Undo.

Changed behavior: Trash hides its card immediately. Read immediately uses regular
sender/subject weight while pending, then removes the card after confirmation.
Failures restore authoritative cached state. Provider-read mail is omitted.
Confirmed projections end once cache reflects the change so later unread replies
can reappear. Account counts update with the projected state and roll back too.

Unknown Gmail write responses trigger one uncached owning unread-feed check.
Only a complete feed can establish absence; verified absence removes stale cache
mail while keeping the uncertain action lock. It does not prove a Trash move,
enable Undo, or automatically repeat the write.

Synthetic verification: T3 collaborative browser, Midnight 480×600 with a
five-second delayed fake worker. Read immediately measures sender/subject weight
400 and aria-busy true; card disappears on response. Trash immediately hides
its card; no horizontal overflow. No real mailbox writes in this fixture.
Automated tests cover delayed feedback, rollback, stale cache, provider-read
filtering, later unread replies, complete-feed ownership, truncated/offline feed
refusal, no POST replay, and cache reconciliation with retained uncertainty.
Node 24.21.0: npm ci and npm run verify passed, 198 tests, no skipped tests.
Impeccable scan: zero anti-patterns; one existing Signal swatch advisory
(#b4b8bc), no suppressions added.
Independent review: reported projection-lifetime issue corrected and re-reviewed.

## Real-account retest

- [ ] Reload the unpacked extension; test Gmail read/Trash without pressing Refresh.
- [ ] Confirm regular text appears on read click, then card clears.
- [ ] Confirm Trash card clears immediately and stays gone after reopening popup.
- [ ] If response is unrecognized, confirm mailbox state and use “I’ve checked”
  to release the uncertainty lock; do not interpret feed absence as verified Trash.
- [ ] Verify failed actions restore cards and counts; verify account isolation.
- [ ] Verify new unread replies in the same conversation can reappear.
- [ ] Outlook read/Trash/Undo and keyboard focus remain usable.

Browser/version, OS, tested commit and owner retest result: pending.
