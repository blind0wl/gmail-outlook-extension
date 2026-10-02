# Optimistic read and opened-here dismissal — 2026-10-02

Candidate: the optimistic-read commit following `5ea4877` on
`t3code/investigate-email-limits-full-preview`, PR #25.
Owner direction is recorded in `HANDOFF-optimistic-read.md`.

Read and Open dismiss cards synchronously. Read writes run in the worker;
Open records only the existing local opened-here flag. Neither operation
announces progress or success. Failed requests restore a card and surface a
sanitized error. Pending Open stays hidden across older cache snapshots.
Failed reads retain a recovery snapshot even when the worker has already
cached the item as read or removed it before returning an uncertain result.
Recovery snapshots are popup-session state, never persisted as mailbox truth.
Existing action-journal uncertainty locks still apply.

## Scope and discrepancies

- Immediate dismissal supersedes the earlier session-visible pressed toggle
  and successful-read refresh guidance. Read cards are no longer retained for
  an immediate inverse toggle. Gmail unread remains blocked without a verified
  opcode; Outlook's existing unread worker transport remains unchanged.
- The handoff implied ordinary polling clears opened-here dismissal. Existing
  cache merges preserve `localRead`; that persistence is retained. Tests that
  explicitly clear the saved local flag exercise storage-state replacement,
  not normal provider polling.
- The reported test hang was a failing DOM-object equality assertion consuming
  memory while formatting its failure. Removing obsolete `sessionRead`
  retention fixes the behavior; card-absence assertions now compare counts.
  Tests ran sequentially with bounded time/heap; no test workers remain.

## Fresh verification

- Node 24.21.0 and `npm ci`: dependencies installed, audit clean.
- `npm run verify`: syntax/extension identity checks and all 307 tests pass.
- Popup suite: 53 tests, including pending-cache order, silent success,
  duplicate-click suppression, failure restoration, transport rejection,
  and failed Open from a restored recovery card.
- Red/green checks reproduced the old session-retention defect, failed local
  persistence, success erasing an unrelated error, pending Open cache race,
  read-cache/removal error races, and failed Open losing a recovery card.
- Independent code review identified the pending Open and read recovery races;
  both were fixed and covered by failing-then-passing tests.
- `git diff --check` passed. Impeccable detector on popup JavaScript: no findings.

## Real-account Chrome acceptance

Pending for this candidate. T3 preview status and opening a background preview
both returned `available:false`; no live Chrome/mailbox acceptance was performed.
Historical acceptance results are not reused.

Owner checks still needed:

1. On Gmail and Outlook, Read removes the card immediately without status text;
   the owning provider reflects the write after it completes.
2. Open removes the card immediately, opens the correct provider message,
   persists local dismissal across polls/reopen, and leaves provider unread
   state unchanged.
3. Failed/unconfirmed reads restore a card and expose recovery; unrelated mail
   remains usable. Check recovery locks before retrying uncertain writes.
4. Keyboard focus remains usable after dismissal and rapid actions create no
   duplicate writes.
