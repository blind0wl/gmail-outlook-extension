# Gmail plus Outlook

A personal-use Chrome Manifest V3 extension that checks Gmail and Outlook.com
accounts in one popup. It has no backend or analytics. Mail previews, settings,
and cached account data stay in the browser profile; provider requests run in the
extension service worker.

## Features

- Keeps mail grouped by account, with filters, unread counts, desktop alerts,
  an optional chime, and three themes: Midnight desk, Slate workspace, and
  Signal panel.
- Expanding a card loads its complete message. Plain text remains selectable;
  HTML is sanitized and shown in an isolated frame. Credential-free HTTPS
  images load automatically. Their remote hosts receive image requests and may
  track access; the reader sends no referrer. Links open in browser tabs.
- Opening a message in webmail records a local read in the extension without
  changing provider state. Expanding unread mail stages a provider read; it
  commits after five seconds away from the card or immediately when clicking
  elsewhere. Mark unread during that grace period cancels the write.
- Mark read and Trash controls are available on cards. Gmail actions affect the
  whole conversation; Outlook actions affect one message. Trash moves mail to
  the provider's recoverable Trash folder. The extension has no send or
  permanent-delete actions.
- Settings manage accounts, themes, notification behavior, sound, and a shared
  mail-check interval (one minute by default; 30 seconds to five hours).

## Load the unpacked extension

Node.js 24 and npm are only needed for development checks. To use the extension,
open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**,
and select this repository root. Pin **Gmail plus Outlook** to the toolbar.

In the popup, add Gmail after signing in to it in a browser tab. Add Outlook.com
and complete Microsoft's consent flow. Outlook uses a personal Microsoft app
registration; registration and sign-in details are in
[docs/manual-auth.md](docs/manual-auth.md). Work and school Microsoft accounts
are outside the current scope.

After source changes, reload the extension at `chrome://extensions`. There is
no build step or development server. The manifest pins the unpacked extension's
ID; see [docs/extension-identity.md](docs/extension-identity.md) for identity
and migration details.

## Development and acceptance

Use Node 24 (`.nvmrc`) and run:

```sh
npm ci
npm run verify
```

`npm run verify` checks JavaScript syntax and extension identity, then runs the
automated tests. `npm test` runs tests alone; `npm run check` runs syntax and
identity checks alone. `npm run identity` prints the pinned extension ID and
Microsoft redirect URI. CI runs `npm run verify`.

Automated tests use fixtures and Chrome API substitutes. They do not replace
real-account Chrome checks. Use the [PR checklist](docs/pr-checklist.md),
[popup checklist](tests/popup-checklist.md), and
[manual authentication checklist](docs/manual-auth.md), then record a fresh
dated result in `docs/acceptance/` for each feature or bug candidate.

## Architecture and limits

The extension uses plain JavaScript modules, HTML, and CSS. It has no UI
framework, bundler, or production npm dependencies. The
[architecture guide](ARCHI.md) describes the worker, providers, cache, and
popup boundary. Current product scope and owner decisions are in
[PRODUCT.md](PRODUCT.md) and the [specifications](specs/).

The popup renders cached mail and sends requests to the worker; it does not call
mail providers. The cache holds at most 200 messages for up to seven days.
Gmail uses an unsupported private session protocol and exposes only a bounded
recent unread feed; Gmail mailbox actions operate on whole conversations.
Changes to Gmail's private protocol may break access or actions. Outlook uses
Microsoft Graph for a bounded set of recent inbox messages. A provider failure
for one account does not prevent other accounts from working.

Gmail uses the signed-in browser session. Outlook credentials are held in
`chrome.storage.session` and clear when the extension reloads or Chrome
restarts. If a Microsoft browser session is still active, Outlook can reconnect
silently after restart; otherwise sign in again from Settings. Mail bodies are
fetched when opened and retained only while the popup is open. External HTTPS
images load from their hosts when the reader displays them. Attachment images
and unsupported image URLs remain placeholders.

Mailbox writes are limited to read/unread and recoverable Trash/restore
operations; committed Gmail unread is unavailable. The popup has no Undo
button: restore trashed mail in webmail. A ten-minute worker restore journal
and saved recovery records support uncertain actions. Check the affected mail
in webmail before acknowledging recovery with **I’ve checked**.
The extension does not send mail, permanently delete mail, or provide search
and archive actions. Diagnostics exclude message content and credentials.

## Acknowledgements

[Checker Plus for Gmail](https://jasonsavard.com/CheckerPlusForGmail/), created
by Jason Savard, inspired this project. The notification chime at
`src/notify/sounds/chime.mp3` is from Checker Plus for Gmail version 36.5.2;
the source extension's copyright notice reads “Copyright Jason Savard”.
