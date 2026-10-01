# Gmail read refresh guidance acceptance — 2026-10-01

Issue: [#15](https://github.com/blind0wl/gmail-outlook-extension/issues/15)
Candidate: `17699f8` (main HEAD at time of report).
Date: 2026-10-01. Chrome version and OS: not supplied (owner-reported pass).

## Scope

Confirmed Gmail mark-as-read shows immediate extension feedback plus
open-page refresh guidance:

> Marked as read in Gmail. If an open Gmail page still shows unread, refresh that page.

No provider tab is automatically reloaded. Failed reads and Outlook reads
do not receive the Gmail guidance. Implementation in `src/popup/popup.js`,
regressions in `tests/popup-ui.test.js`.

## Owner-reported result

Owner kept Gmail already open, marked read in the extension, confirmed
immediate feedback and refresh guidance, then verified provider read state
after refresh. Reported: **Passed**.

No tokens, mail content, or sensitive diagnostics were recorded.

## Limits

- This accepts the refresh-guidance fallback, not live Gmail-page updating.
- Broader #16 Trash/Undo acceptance is tracked separately; this record does
  not close #16 or #20.
