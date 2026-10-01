# Read-only Gmail Trash verification — 2026-10-01

Runtime candidate: `4c3d6f59fde072588a31b57525906396347478de` on
`fix/gmail-trash-investigation`, based on merged main `392e5c5`.
Real-account query validation: **pending**. Gmail Trash remains disabled.
Owner-reported browser: Version 0.18.2.1 (Official Build, Chromium
154.0.8037.92), Arch Linux (x86_64).

The saved-target link opened the expected conversation with a deleted notice and
a restore option. This corrects the inference from failed Gmail searches; that
specific target remains recoverable. Earlier actual Trash moves were repeatedly
reported uncertain by the extension. The reference client does not use our ar
acknowledgement rule, but its permissive nonempty-reply check is insufficient to
establish Trash presence. No success parser or write policy changes here.

## Diagnostic scope and limits

`inspectGmailTrash` runs the reference client's fixed `in:trash` query, capped at
80 results. Its query-only POST has no mutation code or target identifiers.
Account ownership is verified through the existing session checks and checked
again after the query. Exact returned identifier matches produce `verified-trash`;
all other targets remain `not-confirmed`. Absence from a bounded query is not
proof of a failed move. Unsupported, malformed or ambiguous response formats
cannot verify anything. It sends no mailbox mutations and writes no cache,
journal or diagnostic history. No popup/runtime message calls it; it is invoked
explicitly from the owner's worker console for this investigation.

The public helper returns ordinal verdicts/counts/fixed error codes only. The
internal exported parser returns target identifiers for matching/testing; do not
log or paste those. No subject/body, URL, account, ID or token is included in the
helper result. The 2 MiB/32-frame limit bounds parsing, not response downloading;
`response.text()` first buffers the provider response. Queries time out after
15 seconds. Private protocol compatibility remains unverified on the real account.

## Fresh verification

- Node 24.21.0: `npm run verify` passed all **219 tests**, none skipped.
- New tests failed before the helper existed. Tests cover raw/framed/XSSI search
  replies, UTF-8 frame lengths, malformed and unsupported data, query-only POST,
  account recheck, privacy, failures and invalid/oversized target batches.
- Independent review found no blocker; `git diff --check` passed.
- No UI was changed. Real-account query validation is not replaced by synthetic
  responses, and no new browser UI acceptance is claimed.

## Existing-record validation — no new Trash writes

- [ ] Reload this candidate and verify Gmail Trash remains unavailable.
- [ ] Keep the disputed saved locks. If Gmail was used to restore a conversation,
  its expected query verdict is not-confirmed. Never delete it again for this test.
- [ ] Run the block below in the extension service worker console. It inspects
  each account's saved unconfirmed Trash targets, at most 80 per account.
- [ ] Paste only the printed result objects. Do not paste the records, account
  names, generated URLs or raw responses. If no objects appear, report that fact.
- [ ] Compare a verified-trash result with the deleted notice for the same saved
  target. An unrecognized-search result needs response-format investigation,
  not relaxed success recognition.

```js
{
  const {inspectGmailTrash} = await import(chrome.runtime.getURL('src/providers/gmail-trash-verification.js'));
  const {mailActions = {}} = await chrome.storage.local.get('mailActions');
  const records = Object.values(mailActions).filter(r =>
    r.item?.provider === 'gmail' && r.action === 'trash' &&
    ['pending', 'uncertain'].includes(r.state));
  const accounts = [...new Set(records.map(r => r.item.account))];
  for (let i = 0; i < accounts.length; i++) {
    const targets = records.filter(r => r.item.account === accounts[i]).slice(0, 80);
    console.log({group: i + 1, ...await inspectGmailTrash(accounts[i],
      targets.map(r => r.id || r.item.key.split(':').pop()))});
  }
}
```

Do not press “I’ve checked” as part of this diagnostic or re-enable Gmail Trash.
#16 stays open until a supported confirmation fix has fresh acceptance.
