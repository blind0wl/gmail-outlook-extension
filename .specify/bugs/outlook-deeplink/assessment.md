# Bug Assessment: Outlook Open does not select the message

- **Slug**: outlook-deeplink (existing project index)
- **Created**: 2026-09-30
- **Source**: tests/popup-checklist.md and baseline follow-up
- **Verdict**: valid
- **Severity**: normal

## Report and symptom

Open should select the cached Outlook message in Outlook on the web. The
existing Graph-ID URL opens the mailbox without reliably selecting the message.
The owner baseline browser was Helium 0.18.1.1 / Chromium 154.0.8037.57,
Arch Linux x86_64; the baseline pass did not separately resolve this known bug.

## Reproduction

With an Outlook.com account connected, refresh mail and click Open on a message.
Compare the opened message with the card's subject. Repeat after restarting the
extension and with another Outlook mailbox signed into the browser.
Automated reproduction: pass a Graph resource containing webLink through fetch,
normalization, cache persistence and hydration, then resolve the popup URL.

## Root cause

The Graph $select omits webLink, normalization discards it, cache projection
would discard it, and the popup synthesizes an undocumented URL from the Graph
ID. Microsoft documents webLink as the URL to open the message in Outlook on
the web: https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0

## Proposed Remediation

Request and preserve webLink through the cache. Prefer it at the popup's final
navigation boundary only for HTTPS on exact Outlook origins without URL
credentials. Accept outlook.live.com (personal mail) and outlook.office.com /
outlook.office365.com (Microsoft's canonical Outlook web endpoints); this does
not add work-account authentication. Keep the existing synthesized fallback for
old cache entries or rejected links, without claiming it reliably selects mail.
Preserve the provider's encoded message URL rather than rewriting IDs or queries.

## Files likely to change

- src/providers/outlook.js
- src/store/cache.js
- src/popup/links.js
- tests/outlook-deeplink.test.js
- README.md, docs/baseline.md, tests/popup-checklist.md
- This bug directory's fix and verification reports

## Tests to add or update

Exercise the real provider/cache/storage bridge/popup resolver with mocked
network and Chrome storage only. Verify Graph selects webLink, encoded URLs
survive a restart and a refresh, unsafe URLs fall back, and Gmail ignores it.
Check the real popup Open handler using the synthetic browser fixture.

## Risks & Considerations

Old cached entries require a successful refresh to obtain webLink. Outlook
browser sessions still determine sign-in behavior. Real-account selection and
multiple-mailbox acceptance remain owner gates; synthetic checks cannot prove
Microsoft's remote UI behavior. No new permissions or dependencies.

## Open Questions

None blocking implementation. Real-account acceptance remains pending.
