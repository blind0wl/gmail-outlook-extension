# Popup workspace and mailbox actions — capability map

Module boundaries and recommended delivery order approved by the owner, 2026-09-30. The visual direction is approved; this
map sets implementation boundaries and order, not completed functionality.
Spec Kit will own each module's specification, plan and tasks under specs/.

| Module ID | Responsibility | Depends on |
| --- | --- | --- |
| popup-workspace | Account sections, separate Mail/Settings navigation, existing account and alert/sound controls, three persisted themes with Midnight desk default | Existing worker/cache contracts |
| gmail-api | Supported Google authorization and account-bound Gmail API reads, mailbox identity and migration from cookie-feed cache, preserving multiple-account support | Existing account/session ownership |
| mailbox-actions | Provider-backed message read/unread and Trash/Deleted Items; Outlook permission upgrade; worker command validation, pending/error handling, cache/poll synchronization and acceptance for both providers | gmail-api; popup-workspace for final visible controls |

Recommended delivery: popup-workspace → gmail-api → mailbox-actions, with a
reviewed PR and applicable acceptance at each boundary. The layout can ship
without waiting for Google setup. Provider action buttons become available
with their functioning provider integration, rather than shipping simulated
writes. Existing behavior remains documented until the relevant module lands.

Interfaces: popup-workspace consumes account/cache/settings records and worker
messages. gmail-api supplies verified account identity, credentials and provider
message IDs. mailbox-actions owns the mutation command/result boundary and
updates authoritative cache state. Detailed contracts belong in module specs
and plans; no new module can issue provider requests from the popup.

Mailbox-action requirements and technical follow-up:

- Supported Gmail writes require Google OAuth/API setup and additional consent;
  the cookie Atom feed cannot do them. Recommend API reads and writes together
  after account authorization, avoiding unproven feed-to-API ID mapping.
- A card should represent and act on one provider message, rather than silently
  changing every message in a Gmail conversation. The owner approved individual-message actions.
- Preview expansion should display text only once real read/unread exists;
  explicit read/unread controls change the mailbox. The owner approved this change from v1.
- Trash recovery must be specified. The owner approved Trash Undo as a requirement; its production contract
  still needs specification; reliable cross-provider undo requires handling
  move IDs/original folder and uncertain network outcomes.

Sending, permanent deletion, archive/star, search, work/M365 accounts, backend
services and the queued Gmail stale-Open investigation remain outside scope.
No production code or permissions are changed by this map.
