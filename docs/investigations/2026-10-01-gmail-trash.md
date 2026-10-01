# Gmail Trash investigation — 2026-10-01

Base: merged PR #18, main `392e5c5903e775ea862ad7f555503ef2fefa00e2`.
Follow-up branch: `fix/gmail-trash-investigation`. Gmail Trash stays disabled.
Owner confirmed unavailable controls before merging. No further real-mail write
reproduction is requested, and no prior uncertain POST may be replayed.

## Established evidence

- Earlier five/four disputed moves were verified in Gmail Trash after refresh,
  while the extension reported uncertain results. This supports false-negative
  confirmation for those specific moves, not all later attempts.
- A later diagnostic event reports slot 1, HTTP 200, unrecognized reply,
  uncertain outcome, unreadInboxAbsent false. No raw reply was collected.
- Later conversations were absent from Inbox/Trash and `in:anywhere` searches.
  The owner found a separate conversation by search before clicking extension
  Trash, then reported it could no longer be found. Actual labels/permanent
  deletion/recoverability are not established.
- Pending/uncertain records retain key, account, provider and action target ID,
  while removing subject/snippet. Acknowledgement deletes those records; keep
  them intact during investigation. Saved diagnostics contain no target IDs.

## Request/response audit

Read-only comparison to inbasic/ignotifier at
`df220fa2eff2ba48627f72ca9220a0f7aace817b`,
`v3.classic/core/offscreen/gmail/core.js`:

- The single-action FormData/s_jr shape matches: read code 3, Trash code 9,
  target repeated in both fields, l:all, empty arrays and two control records.
- The reference obtains the target from Atom link `message_id` and calls it
  thread. No evidence supports switching opcode or converting that identifier.
- It adds a request timestamp and initially resolves a session page at /s/ with
  meta-refresh fallback. These differences do not establish the reported cause.
- It treats any nonempty reply without /spreauth as successful; it does not
  require the extension's ar acknowledgement. This reference therefore does not
  justify our response matcher, but its permissive criterion cannot establish
  actual Trash presence and must not be copied as a fix.

Source: https://github.com/inbasic/ignotifier/blob/df220fa2eff2ba48627f72ca9220a0f7aace817b/v3.classic/core/offscreen/gmail/core.js

## Next evidence

Use existing locks locally to attempt account-pinned navigation to each exact
conversation under Gmail's #all route, rather than subject/sender search. This
is a compatibility probe, not authoritative proof if navigation fails. The
command reads extension storage and prints links; it sends no provider request
until the owner follows a link, and no Trash request is sent. Opening Gmail may
mark a conversation read as normal Gmail behavior. Do not paste these local
links/records, since they contain account addresses and conversation identifiers.
Report only whether a link opens the expected conversation, an error, or Inbox.

```js
const {mailActions = {}} = await chrome.storage.local.get('mailActions');
console.table(Object.values(mailActions)
  .filter(r => r.item?.provider === 'gmail' && ['pending', 'uncertain'].includes(r.state))
  .map((r, i) => {
    const id = r.id || r.item.key.split(':').pop();
    return {number: i + 1, action: r.action,
      link: /^[a-f0-9]+$/i.test(id) && typeof r.item.account === 'string'
        ? 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(r.item.account) + '#all/' + id
        : 'No valid target saved'};
  }));
```

Do not re-enable Trash on HTTP 200, unread-feed absence or a permissive third-party
response test. A fix requires evidence of the specific Gmail outcome and a
verification mechanism compatible with the approved read/Trash/Undo scope.
