# HTML reader scrolling investigation — 2026-10-06

Investigated `ca23fbe` on branch `investigate/html-reader-scroll` in
`/home/dave/dev/gmail-outlook-extension-reader-investigation`. No production
code was changed. This is an investigation record, not acceptance of a fix.

## Owner evidence

The owner supplied a 26-second recording showing a jump back toward the start
of an expanded HTML message at approximately eight seconds, followed by further
scrolling and an apparently unresponsive view. Closing and reopening the popup
removes the message from the unread list. The owner reports this with almost
every email, with the checking interval configured to 30 seconds. An account
checked-time change coincides with the visible jump, but that does not establish
the trigger or prove that the scheduled poll caused the entire incident.

## Reproduced defects

The T3 shared browser ran the repository's production popup through the existing
synthetic Chrome boundary, served locally. No real accounts, provider requests,
mailbox writes, credentials, or owner email content were used.

1. With a long synthetic HTML message expanded and mail scrollTop at 900, an
   accountState-only storage notification destroys the existing iframe and
   replaces it. ScrollTop immediately falls to 93 before returning to 900 after
   the replacement frame loads. Browser scroll anchoring can therefore mask
   part of the reset, but a disruptive intermediate layout is confirmed.
   `renderStatus()` calls `renderList()`, which removes every account/card and
   recreates the frame. Cache and action-journal updates also rebuild the list.
2. Focusing the iframe before that update loses reading focus: activeElement
   changes from the message frame to the Refresh button after the rebuild.
   Focus restoration does not recognize the HTML reader as a distinct target.
3. In a controlled event sequence, inner pointer activity followed by a parent
   pointerout with relatedTarget=null clears hover state. A subsequent inner
   wheel event does not restore it. After 5.2 seconds the popup dispatches a
   read action and removes the expanded card despite the frame retaining focus.
   This is an event-path reproduction; the precise native pointer sequence in
   the owner's recording has not been observed. The frame listens for pointer
   movement/down and keydown, but not wheel. The staged-read focus safeguard
   applies only in keyboard mode.

Ordinary long-paragraph content settled after one ResizeObserver callback per
frame; no sustained sizing feedback loop was reproduced for that sample.

## Source findings and limits

The worker's message-body handler reads the body and returns it without polling
or stamping account checkedAt. A successful poll stamps checkedAt. The mailbox
read action itself updates cache/journal but does not stamp checkedAt. The
opening path stages a read and its independent five-second timer. Popup blur or
pagehide commits staged reads; closing after a lockup is therefore enough to
explain the message being read on reopening.

The persistent lockup from the recording has not been reproduced. Frame
replacement/focus disruption are credible contributors, but are not proven to
be its complete cause. Extension-popup lifecycle and native wheel behaviour
still require fresh real-account Chrome validation of any proposed fix.

## Proposed correction

Preserve the live reader/card across status and unchanged-message updates;
update account status without rebuilding message frames. Preserve reader focus
and scroll across necessary list changes. Count frame wheel activity as reading
and prevent pointer-mode focus loss from committing a read during active use.
Keep the approved close-popup read commitment and mailbox write scope intact.

Regression verification should cover unchanged cache/status updates while
scrolled, focused frame retention, wheel-only reading past five seconds, and
explicit popup close still committing once. No fixed-candidate acceptance or
test-suite pass is claimed by this investigation.
