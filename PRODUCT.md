# Product scope

Gmail plus Outlook is a personal-use Chrome extension for checking multiple
Gmail and Outlook.com accounts in one popup. It prioritizes clear account
ownership, quick mail reading, keyboard access, and independent account
failure handling.

## Current experience

- The Mail view groups messages under their full-address account headings.
  Filters preserve account identity. Settings manages accounts, themes,
  notifications, sound, and one shared polling interval.
- Mail cards show a short preview. Expanding a card loads the complete body;
  plain text stays selectable and sanitized HTML appears in an isolated reader.
  Credential-free HTTPS images load automatically. Remote image hosts receive
  those requests and may track access; no referrer is sent. Attachment images
  remain placeholders.
- Opening a provider link records local read state in the extension and does
  not change the provider. Expanding unread mail stages a provider read. It
  commits after five seconds away from the card or immediately on an outside
  click; hover and keyboard focus pause the timer. During the grace period,
  Mark unread or Trash cancels the pending read. Gmail provider unread state
  remains unavailable after a committed read.
- Cards support mark-read and recoverable Trash actions. Gmail actions operate
  on whole conversations; Outlook actions operate on individual messages.
  Confirmed Trash has no visible Undo control. Uncertain outcomes stay locked
  to the affected mail until the user checks the mailbox and acknowledges the
  result.
- Midnight desk is the default theme. Slate workspace and Signal panel are
  also available and remembered. The default polling interval is one minute;
  users can set a whole-second interval from 30 seconds to five hours.

## Data and provider boundaries

The popup is cache-only. A background service worker makes provider requests,
normalizes results, and owns mailbox writes. Account errors remain isolated.
Mail and settings are stored in the browser profile. There is no backend or
analytics. Outlook tokens use session storage and clear on extension reload or
browser restart; the extension can silently reconnect after restart if the
browser's Microsoft session is still active. Gmail uses the existing browser
session and stores no Gmail token.

Gmail access and actions use private, unsupported session endpoints rather
than the Gmail API. Protocol changes may interrupt reads or actions. Gmail
mailbox actions cover whole conversations. Outlook support is limited to
personal Microsoft accounts and uses Microsoft Graph. The cache is bounded
and contains recent inbox/unread results, not a full mailbox. See
[ARCHI.md](ARCHI.md) for implementation boundaries and limits.

Provider writes are limited to read and recoverable Trash/restore operations.
The extension does not send mail, permanently delete mail, or provide compose,
archive, or search features. Diagnostics exclude mail content and credentials.
Remote email images are the exception to provider-only network access: the
reader loads credential-free HTTPS images directly from their hosts, without a
referrer.

## Approved scope and evidence

The [v1 design](docs/superpowers/specs/2026-09-28-gmail-outlook-extension-design.md)
owns baseline product scope. Later owner-approved amendments and acceptance
records below supersede its historical behavior where explicitly documented.

The current owner-approved mailbox action and recovery scope is in
[specs/003-mail-cards-actions/spec.md](specs/003-mail-cards-actions/spec.md).
Popup organization, settings, and visible deletion feedback are in
[specs/004-popup-ux-settings/spec.md](specs/004-popup-ux-settings/spec.md).
The [design system](DESIGN.md) records the shipped themes and visual decisions.

Dated records in [docs/acceptance/](docs/acceptance/) preserve candidate-level
verification; a past pass does not establish acceptance of a later change.
The formatted reader passed its owner-reported smoke test on 2026-10-06 in
[its acceptance record](docs/acceptance/2026-10-06-html-message-reader.md).
Automatic image loading was added on 2026-10-07, and its fresh real-account
acceptance remains pending in [the current record](docs/acceptance/2026-10-07-automatic-email-images.md).
