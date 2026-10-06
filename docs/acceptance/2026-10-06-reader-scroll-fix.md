# Reader scrolling fix — 2026-10-06

Candidate branch: `investigate/html-reader-scroll`, based on `ca23fbe`.
The owner requested a correction, automated verification, a built-in-browser
smoke test with video, then a commit and a PR ready for review/merging.

The [investigation](2026-10-06-reader-scroll-investigation.md) records the supplied
video and the two reproduced failure paths. This candidate preserves the current
visual design and approved provider read/Trash/Undo scope. Impeccable UI
performance guidance informed the investigation and implementation.

While a reader is expanded, existing card and account-section order is retained
to avoid detaching its iframe. Newly arrived cards are inserted relative to the
current message order; existing entries resume normal sorting on a later render
after the reader is collapsed. This deliberately defers movement of existing
entries during reading, rather than changing message membership or counts.

## Verification

- Node 24.21.0: `npm ci` succeeded; `npm run verify` passed syntax checks for
  65 JavaScript files, extension identity validation, and all 382 tests.
- Regression coverage includes cache/status/action/new-mail updates preserving
  frame identity and focus; pointer-mode frame focus after pointer exit;
  wheel/scroll activity past five seconds; filtered staged reads; dismissal
  committing once; Escape/image opt-in; and retained-reader account cleanup.
- Independent read-only review found no remaining material blockers after
  correcting subject-node tracking, account body cleanup, filtered pending
  reads, and error-node tracking. Parent inspected the actual diff and results.
- Impeccable detector reported only two pre-existing advisory colours in the
  HTML reader stylesheet (`#1558bc`, `#bbb`); this candidate changes no colours.
- Built-in T3 browser at 480 × 600, production popup HTML/CSS/JS with synthetic
  Chrome boundaries: opened a 32-section HTML email, exercised mouse-mode
  iframe focus/pointer exit/wheel, and scrolled forward and backward through
  the final paragraph. During 28 once-per-second cache/status/action update
  cycles, frame identity, connectedness, focus and exact scrollTop were
  preserved on every update. No browser error events or read writes occurred
  while reading. Escape collapsed, reopening worked, and two simulated pagehide
  events produced exactly one read write.
- The [38-second browser recording](evidence/2026-10-06-reader-scroll-smoke.mp4)
  shows the successful scrolling sequence. It is the built-in browser's native
  MP4 capture, normalized to 30 fps for playback. A first recording attempt was
  discarded after the browser automation client disconnected before test setup;
  the reconnected successful run is the evidence linked here.

Reproduce the synthetic surface by serving the repository root locally and
opening `tests/visual/reader-scroll.html`. `readerSmoke.refresh()` issues cloned
cache, account-state and action notifications; its counters expose refresh and
read-write counts. The smoke used focused inner-frame activity plus built-in
browser scrolling of `#mail-view`; it does not replace native Chrome extension
popup lifecycle or provider acceptance.

## Real-account Chrome acceptance

Pending for this candidate. Synthetic browser verification cannot establish
that the owner's extension-popup lockup is eliminated on real mail.

1. Load/reload the extension from this candidate's checkout.
2. Open a long HTML email and scroll for at least 30 seconds, spanning a mail
   check. Confirm no jump, frozen scrolling, lost reader focus or card dismissal.
3. Reach the final content; scroll back up and down repeatedly. Try an email
   with images hidden, then with images explicitly loaded.
4. Repeat for Gmail and Outlook where available. Collapse/reopen and Escape
   should work; unrelated account errors must not interrupt the current reader.
5. Close the popup and reopen: opening unread mail should retain the existing
   approved mark-read-on-close behaviour. Read/Trash controls remain usable.

Record a fresh owner result here; historical reader acceptance does not apply
to this fix candidate.
