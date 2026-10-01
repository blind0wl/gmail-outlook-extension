# Email cards and mailbox actions

Implementation contract updated 2026-10-01. The owner explicitly authorized working mailbox actions,
superseding the v1 read-only constraint for mark-read and recoverable Trash only.
The popup remains cache-only, diagnostics content-free, and accounts isolated.

| Capability | Responsibility | Dependency |
| --- | --- | --- |
| gmail-session | Verified browser session and conversation actions | Existing Gmail login |
| mailbox-actions | Worker-owned mark-read, Trash, Undo, durable recovery | Provider sessions and verified ownership |
| mail-cards | Rounded cards, bold headings, three-line text, hover actions | mailbox-actions |

## Contract

- Preserve all three themes and full-address account sections; widen to 480px,
  shrink to the host width. Separate message cards with 12px corners and gaps.
- Sender and subject are bold for unread mail and regular after marking read. Cached plain-text snippet
  is immediately visible, clamped to at most three lines. No preview expansion.
- Hover reveals mark-read and Trash icons. Keyboard focus reveals the same
  controls; non-hover devices expose them. Keep the existing provider Open
  button. Opening a full message inside the extension is deferred.
- Mark-read changes the actual provider UNREAD/isRead state. Delete moves one
  message to Trash/Deleted Items, never permanently deletes. Undo is stored in
  browser local storage for ten minutes and survives popup close/worker restart.
- Gmail uses existing browser login and conversation IDs from Atom links. The
  owner approved conversation-wide actions on 2026-10-01; no Google OAuth or
  Cloud setup. Resolve and recheck the owning browser slot before each write.
  A cookies permission accesses Gmail’s session action token inside the worker.
- Outlook uses Mail.ReadWrite; save the returned move ID and original folder for
  Undo. Existing credentials need sign-out/sign-in to renew consent.
- Serialize actions against polls, reject duplicate requests, guard sign-out
  races, persist pending mutations before sending. After an uncertain response,
  lock further actions, ask the user to check the provider mailbox, and require
  an explicit “I’ve checked” acknowledgement before allowing further attempts.
- No new-mail alerts/chime from manual operations; confirmed cache/badge updates
  stay account-specific. Restore Inbox on Undo (the surface contains Inbox only).

## Implementation and verification

Plain JS ES modules; authored SVG icons, native buttons, textContent for mail.
Provider requests/auth stay under src/providers and src/auth; the worker validates
commands against stored accounts/cache, never accepts caller-provided URLs/IDs.

1. Provider/auth slice: implement documented APIs, ownership checks and guarded
   sessions. Focused tests cover request methods, origins, IDs and errors.
2. Worker slice: durable mutation/Undo lifecycle, serialization and recovery.
   Tests cover timeout reconciliation, duplicate clicks, account isolation,
   sign-out during mutation, worker restart and expired Undo.
3. UI slice: cards, automatic preview, hover/focus icons, pending/error/Undo.
   Update former preview tests to the replacement requirements and exercise
   synthetic T3 browser states at 480px and narrow widths across all themes.
4. Run Node 24 npm ci, npm run verify, git diff --check and Impeccable detector;
   independent review. Record fresh dated real-account acceptance as pending
   until the owner tests Google/Microsoft consent and actual server changes.

## Transport decision update

The owner rejected Google Cloud/OAuth setup for Gmail. Checker Plus 36.5.2
(published Firefox package, inspected outside the repository) confirms its
autoDetect path uses authenticated internal Gmail web requests for read/Trash,
with conversation IDs. Its manual mode uses OAuth. The proposed OAuth plan above
is superseded and has not been implemented. The owner approved conversation-wide semantics; Gmail web transport needs isolated testing
and real-browser acceptance before enabling writes. No vendor source was copied.

## External setup and limits

Gmail session actions and especially the legacy Undo endpoint need real-account
acceptance; fail closed on missing session keys or unrecognized acknowledgements.
No Gmail OAuth or client configuration is shipped. No backend, client secret, send, compose,
permanent deletion, full-message reading or work/school Microsoft accounts.

Sources: [Chrome Identity](https://developer.chrome.com/docs/extensions/reference/api/identity),
[Gmail API](https://developers.google.com/workspace/gmail/api/reference/rest),
[Graph move](https://learn.microsoft.com/en-us/graph/api/message-move),
[Graph update](https://learn.microsoft.com/en-us/graph/api/message-update),
[Graph immutable IDs](https://learn.microsoft.com/en-us/graph/outlook-immutable-id).


## 2026-10-01 feedback correction

Owner reported successful Gmail read/Trash writes with delayed or stale popup cards.
Trash now hides immediately; read immediately uses regular heading weight while
pending, then disappears after confirmation. Failed actions remove the temporary
projection and render the authoritative cache. Provider-read cards are omitted.
Confirmed projections end when cache reflects the action so new unread replies
can reappear. Popup remains cache-only.

An unrecognized Gmail write response triggers one uncached unread-feed GET.
Only a complete feed for the owning account can establish absence. Verified
absence removes the stale cache card, but does not prove a Trash move or enable
Undo: the uncertain write lock remains, and no POST is automatically repeated.

## 2026-10-01 Gmail follow-up candidate (#15 / #16)

Recovery and Undo precede the mail list. Uncertain writes lock only their
conversation/message; acknowledgement is serialized with writes and must not
be blocked by an unrelated queued action. Gmail session ownership/key GETs
bypass the HTTP cache, and the action token is acquired after those requests.
Worker diagnostics use fixed fields without mail content, account addresses,
message IDs, URLs or session keys. Unknown responses retain explicit recovery.

Confirmed Gmail read feedback explains that an open Gmail page may need
refreshing; no provider tab is automatically reloaded. The owner also reported
second-account Trash leaving conversations in Inbox after refreshing Gmail.
The token-order change is a candidate mitigation, not a proven resolution of
that provider failure. Fresh acceptance remains pending in
docs/acceptance/2026-10-01-gmail-action-recovery.md.

Owner follow-up: dozens of identical recovery rows made the popup unusable.
Unconfirmed records now group by account with a count. One explicit “I’ve checked”
acknowledges only the records captured by that button, after checking all those
actions in the owning mailbox. Failed acknowledgements/new records remain;
no provider write is replayed. Timestamp and state checks protect newer locks
and successful Undo. Fresh acceptance is recorded in
docs/acceptance/2026-10-01-grouped-mail-recovery.md.

## 2026-10-01 Gmail Trash containment

The owner later reproduced a conversation visible in Gmail search before an
extension Trash attempt and absent afterward, without verified Trash presence.
Permanent deletion is not established. Gmail Trash is temporarily disabled in
the popup and rejected by the worker before provider access or cache/journal
mutation. This is an explicit temporary deviation from the approved Trash scope
while the private transport is investigated; it does not widen the permitted
actions. Existing recovery records remain saved, and no action is replayed.
See docs/acceptance/2026-10-01-gmail-trash-containment.md for fresh verification.


## 2026-10-01 compact Undo stack

Owner requested Undo remain at the top without forcing repeated scrolling while
trashing multiple messages. Confirmed Undo now lives below the toolbar, outside
the scrolling mail view, in a collapsible tray with a fixed 112px list viewport.
Newer deletions precede older ones; each retains its own worker-validated Undo.
The existing ten-minute durable window is unchanged. Rows show subject, account
and rounded-up minutes remaining; a popup timer removes them at their deadline.
New rows return the tray to the top unless an older Undo retains keyboard focus;
countdown updates preserve tray scroll. Settings hides the tray and Back restores
its disclosure state. Unconfirmed recovery stays grouped before the mail list.
Fresh acceptance: docs/acceptance/2026-10-01-compact-undo-stack.md.


## 2026-10-01 Undo burst confirmation candidate

Owner reported roughly fifteen rapid Undos, unconfirmed/account-error feedback,
then all messages present in Gmail Inbox after signing in again. That establishes
restoration was observed, not why confirmation failed or that sign-in was needed.

Gmail Undo now confirms with at most three exact-state reads, waiting 300ms then
1000ms between unsuccessful checks. Account ownership and worker authorization
are rechecked; the mailbox POST is never retried. Unknown/mixed state after the
bounded reads retains the existing explicit recovery lock. The shared worker
queue continues to serialize different messages.

A missing/removed Undo record returns `undo-expired` before account lookup instead
of claiming the account is signed out. Popup copy explains mail may already be
restored. Only explicit authentication errors recommend Settings sign-in; transient
session discovery and unclassified failures report service unavailability.

Delayed state is a reproduced synthetic failure mode and candidate explanation,
not a verified cause of the owner's Gmail incident. Fresh real-account acceptance
is pending in docs/acceptance/2026-10-01-undo-burst-confirmation.md.
