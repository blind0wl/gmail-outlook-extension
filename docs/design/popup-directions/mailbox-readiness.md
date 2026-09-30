# Mailbox-action readiness — 2026-09-30

Preparatory research for the approved gmail-api and mailbox-actions modules.
This is not their technical plan, a verified OAuth integration or acceptance.
The first popup-workspace stage needs no new provider consent or Cloud setup.

## Current repository facts

- Gmail reads cookie-authenticated Atom unread feeds, probes browser slots and
  derives cache IDs from feed links. It has no Gmail OAuth implementation.
- Outlook uses Graph inbox reads and personal-account PKCE OAuth with User.Read,
  Mail.Read and offline_access. Credential slots and session invalidation are
  account-specific; sign-out races are already covered by tests.
- Worker serializes writes and polling. Cache reconciliation only removes absent
  mail on complete snapshots; legacy localRead remains true across merges.
- Popup preview currently sends local mark-read. The approved first-stage spec
  makes preview display-only without adding provider writes.

## Supported provider operations

Gmail read/unread can change UNREAD labels through the per-message modify
endpoint. Trash and untrash have dedicated per-message endpoints. Use
`gmail.modify`, rather than the broader full-mail scope needed for permanent
bypass-of-trash deletion. Its consent scope is broader than the app's requested
features; the app still never composes, sends or permanently deletes.
Sources: [modify](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/modify?hl=en),
[trash](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/trash?hl=en),
[untrash](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/untrash?hl=en),
[scope definitions](https://developers.google.com/workspace/gmail/api/auth/scopes).

Outlook can PATCH isRead and POST move to `deleteditems`, requiring delegated
Mail.ReadWrite for personal accounts. Move returns a message resource; undo must
use the returned identity and recorded original folder, rather than assume an
old ID still works. Immutable IDs are a possible strategy requiring explicit
read/move/migration coverage, not an automatic drop-in change.
Sources: [update message](https://learn.microsoft.com/en-us/graph/api/message-update?view=graph-rest-1.0),
[move message](https://learn.microsoft.com/en-us/graph/api/message-move?view=graph-rest-1.0),
[immutable identifiers](https://learn.microsoft.com/en-us/graph/outlook-immutable-id).

## Gmail setup and feasibility gate

Google Cloud project, enabled Gmail API, consent configuration and an appropriate
public OAuth client tied to extension identity must be prepared. Credentials
must not depend on a bundled client secret or a backend, and flows must support
multiple independently selected accounts on the owner's Chromium/Helium setup.

Chrome documents getAuthToken account selection, but getAccounts is dev-channel
only. Its launchWebAuthFlow description targets non-Google providers. Google
installed-app guidance directs Chrome extensions to the Identity API. Therefore
neither copying Microsoft's PKCE flow nor assuming multi-account getAuthToken
works on Helium is verified. Resolve the supported client/flow/browser combination
in a bounded authentication feasibility check before selecting the production
transport. Do not implement undocumented Gmail web mutations as a fallback.
Sources: [Chrome Identity](https://developer.chrome.com/docs/extensions/reference/api/identity),
[Google installed-app authorization](https://developers.google.com/identity/protocols/oauth2/native-app).

`gmail.modify` is restricted. Personal-use exceptions may avoid verification,
while external testing-mode refresh tokens can expire after seven days. Confirm
actual consent/client status before promising unattended persistence or public
distribution; do not conflate personal acceptance with Chrome Web Store readiness.
Sources: [verification exceptions](https://support.google.com/cloud/answer/13464323?hl=en),
[OAuth token lifetime](https://developers.google.com/identity/protocols/oauth2).

## Required specification work before writes

- One card targets one provider message; preview is display-only; Trash has Undo.
  These outcomes are owner-approved. Define Undo availability, expiry, dismissal,
  popup close/reopen and original-folder/label restoration before implementation.
- API reads should supply verified identity and IDs directly. Feed IDs must never
  be guessed into write targets. Specify account/cache migration, initial quiet
  synchronization, legacy local-read retirement and read-mail visibility.
- Validate command ownership from stored account/message records. Preserve
  per-account sign-out generations and token isolation on every action commit.
- Pending actions must resist double-clicks, stale poll resurrection and unknown
  timeout outcomes. Reconcile uncertain server state before retrying a move; do
  not claim success or blindly replay a mutation.
- Keep manual read/Trash/Undo quiet: no new-mail toast or chime caused solely by
  the user's own operation. Update counts from confirmed authoritative state.
- Make auth/permission denial, expired/revoked credentials, wrong account, 404,
  429, offline and Undo failure testable with sanitized feedback.
- Amend read-only/local-read constitutional statements explicitly for the
  authorized later modules without weakening privacy, isolation or completion gates.

These technical questions do not block the first layout/theme specification.
