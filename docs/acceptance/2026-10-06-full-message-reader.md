# Full message reader — 2026-10-06

Candidate: branch `expand-full-email-view-1` in worktree `t3-2c817935`.

The owner requested full email text on expansion and an owner-run smoke test
following verification. No built-in skills were used.

## Automated evidence

- Node 24.21.0 `npm ci`: successful, zero reported vulnerabilities.
- `npm run verify`: syntax/extension identity checks and all 369 tests pass.
- New coverage: exact Gmail member/latest-conversation selection, incomplete
  replies, post-request account ownership, full Outlook body, Graph redirect
  rejection, safe HTML-to-text conversion, worker target authorization,
  sign-out during loading, loading/retry, delayed accordion responses, body
  selection, cache reuse and sign-out invalidation.
- Independent code review found stale body visibility after sign-out; fixed
  with body invalidation and covered by pending and completed-response tests.
- T3 collaborative browser, production popup HTML/CSS/JS with synthetic Chrome
  boundary at 420 × 600: a long body reaches its final line through inbox
  scrolling, has no horizontal overflow or live image/script/frame nodes,
  and uses one body request. Failure → Retry displays the replacement body
  while keeping the card expanded. The synthetic loading fixture also showed
  the explicit loading status.

These checks do not establish live Gmail or Outlook acceptance. Gmail uses its
existing private session conversation protocol; unsupported body shapes show
an error rather than a preview falsely labeled as complete content. No actual
mailbox access or mailbox writes were performed during this task.

## Owner Chrome smoke test — pending

1. Open `chrome://extensions`, enable Developer mode, and reload the unpacked
   extension loaded from this worktree root. If Chrome currently loads another
   checkout, use Load unpacked and select
   `/home/dave/.t3/worktrees/gmail-outlook-extension/t3-2c817935`.
2. Refresh the popup. Choose a long unread email. Click its card, wait for loading
   to finish, then scroll to the bottom. Compare the final paragraph against
   the owning mailbox. Expect complete selectable text and preserved paragraphs;
   inline images and attachments remain in the provider mailbox.
3. Collapse and expand the card again while it remains in the list. Confirm its
   body returns. Select/copy text inside the body; it should stay expanded.
4. Repeat on Outlook and another Gmail account if configured. Each body must
   match the selected message in the owning account. For a Gmail conversation,
   the Atom member is selected, or the latest member for a conversation target.
5. With the popup closed, go offline, reopen it and expand a different uncached
   email. Expect the cached preview plus a loading error and Retry. Reconnect
   and press Retry; the complete body should appear.
6. Confirm existing read-on-expand behavior: the card remains while reading;
   leaving it commits the staged read and removes it from the unread list.

Record pass/fail, provider and any loading error. Mail content and credentials
are not needed for a failure report. Live-account acceptance remains pending
until the owner reports these results for this candidate.


## Owner smoke-test result — 2026-10-06

The owner reported “ok that works” for the full-text reader in this worktree.
This records an owner-reported pass for reading complete message text; the
provider, multi-account coverage, offline retry and each individual checklist
item were not separately specified. The owner then requested investigation
of displaying the message with its original email formatting.
