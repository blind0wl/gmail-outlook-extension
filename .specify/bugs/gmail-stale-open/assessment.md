# Assessment: Gmail briefly shows deleted mail when opening a cached link

Date: 2026-09-30. Inspected implementation: bd548c9 (PR #9 open).
Status: diagnosed as stale-link/display behavior; no repair applied.

## Owner reproduction and observation

Open a Gmail message from the extension, delete it in Gmail, close Gmail,
then Open the still-cached extension entry before the next successful refresh.
Gmail opens the message and briefly shows it when returning to Inbox, then
removes it from the Inbox display. Repeated Open reproduces the appearance
until the extension refresh removes the entry.

The owner checked the server-facing mailbox state and confirmed:
“Still in Trash/Bin; Inbox appearance is brief”. No lasting Inbox restoration
was observed. Environment was not separately reconfirmed for this report.

## Code evidence and limits

src/popup/links.js builds account-aware #inbox/<id> Gmail links.
src/popup/popup.js marks the item locally read and opens that URL in a tab;
it makes no Gmail restore/move request. The Gmail provider reads Atom feeds.
Successful complete account reconciliation removes absent cached entries.
Before that poll, the popup still has its previous snapshot.

The owner observation rules out persistent restoration in this reproduction.
The inbox-context URL and Gmail's own loading state are a plausible cause of
the transient display, but Gmail's internal behavior has not been traced.
No automated test or synthetic preview can establish that browser behavior.

## Disposition and possible follow-up

Track separately from stable extension identity; do not change PR #9's
accepted implementation for this report. Refresh clears the stale entry.
No runtime change, new permission, canonical .dev update, or completion claim.

A future link-UX repair should first compare an alternate Gmail route using
the same deleted message and account. It must retain exact-message/account
selection for live mail and avoid claiming current inbox membership for a
cached message. Refresh-on-Open or provider API access would change the
current cache-only popup contract and needs a separate design decision.
