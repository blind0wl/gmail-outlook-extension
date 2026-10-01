# Read-only Gmail Trash verification — 2026-10-01

Runtime candidate: `ebcfa83527c680d5fe7a0a1d9e5f5f92ec88597e` on
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
journal or diagnostic history. No popup/runtime message calls it. The worker
statically imports it and exposes a no-argument console helper that validates
the saved target's active configured account, serializes with polling and guards
sign-out before returning any result. It inspects the first saved target only;
repeat calls inspect that same target while its lock remains saved.

The public helper returns ordinal verdicts/counts/fixed error codes only. The
internal exported parser returns target identifiers for matching/testing; do not
log or paste those. No subject/body, URL, account, ID or token is included in the
helper result. The 2 MiB/32-frame limit bounds parsing, not response downloading;
`response.text()` first buffers the provider response. Queries time out after
15 seconds. Private protocol compatibility remains unverified on the real account.

## Fresh verification

- Node 24.21.0: `npm run verify` passed all **222 tests**, none skipped.
- New tests failed before the helper existed. Tests cover raw/framed/XSSI search
  replies, UTF-8 frame lengths, malformed and unsupported data, query-only POST,
  account recheck, privacy, failures and invalid/oversized target batches.
- Independent review found no blocker; `git diff --check` passed.
- New worker-console tests verify unchanged locks/cache, no inspection of
  completed/non-Trash/foreign records or inactive accounts, and sign-out during
  inspection. They failed before the static helper export existed.
- T3 browser ran the production worker via static import in a temporary real
  module service worker. The helper existed and returned no-saved-target with
  no Chrome storage fixture, proving the command can run in service-worker
  scope. The temporary registration/file were removed. This is not real Gmail
  or extension acceptance. No UI was changed.

## Existing-record validation — no new Trash writes

- [ ] Reload this candidate and verify Gmail Trash remains unavailable.
- [ ] Keep the disputed saved locks. If Gmail was used to restore a conversation,
  its expected query verdict is not-confirmed. Never delete it again for this test.
- [ ] Run the command below in the extension service worker console. It inspects
  the first saved unconfirmed Gmail Trash target, without clearing that lock.
- [ ] Paste only the printed result objects. Do not paste the records, account
  names, generated URLs or raw responses. If no objects appear, report that fact.
- [ ] Compare a verified-trash result with the deleted notice for the same saved
  target. An unrecognized-search result needs response-format investigation,
  not relaxed success recognition.

```js
console.log(await inspectSavedGmailTrash())
```

Do not press “I’ve checked” as part of this diagnostic or re-enable Gmail Trash.
#16 stays open until a supported confirmation fix has fresh acceptance.

## Failed initial diagnostic command — corrected

The owner's dynamic-import command failed with ServiceWorkerGlobalScope's import
prohibition before any inspection ran. The supplied command was incorrect; it
does not provide a Gmail query result. This candidate uses static imports and
the global console helper above, consistent with Chrome's documented restriction:
https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics
