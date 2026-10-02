# Inbox routing evidence — 2026-10-02

The candidate uses fixed HTTPS provider origins and percent-encoded configured
addresses: Gmail `?authuser=<address>#inbox`; Outlook.com
`/mail/0/inbox?login_hint=<address>`. Missing identities/unknown providers produce
no destination. Existing message Open builders are unchanged.

Unit tests verify encoding and distinct destinations. Synthetic browser checks
verify native header links, one intercepted ordinary activation, preserved
modified clicks and no mail action on heading navigation. These tests prove
URL construction and popup behavior, not provider account selection.

The preceding thread's synthetic nonexistent-address navigation selected an
active Gmail session and reached a loading Outlook page. Those observations
are inconclusive and do not validate either candidate. This build did not inspect
real mailbox contents or perform mailbox writes. Two real accounts per provider,
both navigation directions and missing-session behavior remain pending. Task 3
was implemented as a reviewable compatibility candidate while Task 1's external
acceptance remains open; it is not accepted for release.

Scheduling sources rechecked during this build:
- https://developer.chrome.com/docs/extensions/reference/api/alarms — named
  replacement, delay/period, best-effort 30-second minimum and startup checks.
- https://developer.chrome.com/docs/extensions/reference/api/storage — async
  preference writes/change events; no atomic storage/alarm transaction.
