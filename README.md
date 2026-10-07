# Gmail plus Outlook

A personal-use Chrome Manifest V3 extension combining Gmail and Outlook.com
mail in one popup, with an unread badge, desktop notifications, and an optional
chime. There is no backend or analytics. Mail and credentials stay in your
browser profile and are exchanged only with the providers.

The popup groups cached mail under each account in separate rounded cards, with
bold sender/subject and an automatic preview capped at three lines. Click a card
(or press Enter/Space) to load the complete message. HTML emails preserve headings, colours, tables
and inline styles in a separate reading frame; plain-text mail stays selectable
text. Credential-free HTTPS images load automatically in the reader; embedded
attachment images and unsupported image URLs remain placeholders. Links open
in a browser tab. Full bodies are held only while the popup is open. Hover or
keyboard focus reveals mark-as-read and Trash actions. Gmail uses the existing
browser login and acts on **whole conversations**; Outlook acts on individual
messages through Graph. Trash remains recoverable in the owning mailbox; the
popup has no Undo tray or button. The worker retains its ten-minute restore
journal and existing Undo command.
Gmail Trash and Undo require verified state for every member of the conversation.
Existing unconfirmed recovery records remain saved until you check the mailbox
and acknowledge them.
**Open** opens the provider and marks the item read locally in the extension;
provider unread state is unchanged. The popup's unread counts follow this local
state. **Mark read** changes the card immediately but keeps it available while
hovered or keyboard focused. Leaving it starts a five-second grace period;
clicking elsewhere commits immediately. **Mark unread** during the grace period
cancels the read without a provider request, including for Gmail. Opening a
staged card cancels its pending provider read and records only the local Open.
Full-message reading inside the extension, compose/send, archive and search
remain outside this change.

Gmail actions use an unsupported private session protocol. Confirmation checks
complete conversation membership and labels; Undo uses fresh session metadata
and the current Sync restore operation.
Unrecognized responses never report success; check your mailbox, then use
**I’ve checked** to unlock further actions. No automatic mutation retry occurs.
Unconfirmed-action recovery appears above the mail list. Saved unconfirmed actions use one
counted row per account; check all those actions in the mailbox before using
**I’ve checked** to unlock them. Completed deletions have no visible Undo feedback.
Only the affected conversation or
message is locked; other mail remains usable. Reads stay silent on progress and
success; only errors restore a recovery card and show feedback. Gmail provider
unread remains unavailable after a read is committed.

The Gmail confirmation and Undo fixes passed automated checks and owner-run
real-account tests for repeated cycles, three-message conversations, mixed-folder
conversations and second-account isolation. See the
[dated acceptance record](docs/acceptance/2026-10-01-gmail-exact-state-undo.md)
for candidate details and verification limits.

## Setup

For development, use Node.js 24 (the CI baseline) and npm. `.nvmrc` records the
Node major version; `package-lock.json` pins test dependencies. Node/npm are
only needed for development checks, not for loading the extension.

```sh
git clone https://github.com/blind0wl/gmail-outlook-extension.git
cd gmail-outlook-extension
# If you use nvm:
nvm install
nvm use
npm ci
npm run verify
```

1. Open `chrome://extensions` in Chrome and enable **Developer mode**.
2. Choose **Load unpacked** and select this repository root.
3. Pin **Gmail plus Outlook**, then open its popup.
4. Log into Gmail in a browser tab, open **Settings → Accounts → Add Gmail**, and enter that address.
   Gmail uses your existing browser session; there is no OAuth registration.
5. Choose **Settings → Accounts → Add Outlook**, enter a personal Microsoft address, and complete
   consent. The developer must first register the extension's exact redirect
   URI with the Microsoft application, as described in
   [manual auth](docs/manual-auth.md).

The manifest pins a stable development ID. If upgrading from the earlier
unpinned install, follow [the one-time identity setup](docs/extension-identity.md)
before Outlook sign-in: register the new SPA redirect, disable any old duplicate
install, and re-add accounts/settings in the new ID's storage namespace.

After source changes, reload the extension from `chrome://extensions` and
reopen the popup. There is no build step or development server.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the locked development dependencies. |
| `npm test` | Run all Node tests, including the popup DOM tests. |
| `npm run identity` | Validate the public key and print the pinned ID/Microsoft redirect URI. |
| `npm run check` | Parse JavaScript files and validate the manifest's public key. |
| `npm run verify` | Run syntax/identity checks and the full test suite, as CI does. |
| `git diff --check` | Check the proposed diff for whitespace errors. |

GitHub Actions runs verification on PRs and pushes to `main`. The suite uses
fixtures and Chrome API substitutes; it does not authenticate real accounts,
exercise Chrome's extension lifecycle, or validate native notifications/audio.
Syntax checking is not linting or type checking; neither is configured yet.

## Architecture

The extension uses plain JavaScript ES modules, HTML, and CSS, without a UI
framework, bundler, or production npm dependencies.

| Path | Responsibility |
| --- | --- |
| `manifest.json` | Extension version, permissions, popup, and worker entry. |
| `src/background/service-worker.js` | Alarms, serialized polling/writes, account lifecycle, badge, and toast dispatch. |
| `src/providers/` | Gmail session-cookie Atom feeds and Microsoft Graph mailbox queries and message actions. |
| `src/auth/` | Personal Microsoft OAuth/PKCE, renewal, and session invalidation. |
| `src/store/` | Account normalization and the bounded mail cache. |
| `src/popup/` | Cache-only rendering, provider links, and actions sent to the worker. |
| `src/notify/` | Notifications, mute/volume settings, and offscreen MP3 chime. |
| `tests/` | Automated regressions, fixtures, and the popup acceptance procedure. |
| `.dev/`, `.specify/` | Historical workflow records and specification tooling; not an active ai-dev-system workflow. |

The worker fetches provider data, normalizes it, and writes to
`chrome.storage.local`. The popup reads that cache and sends account/refresh/
local-read/mailbox-action/full-body messages to the worker; it never calls provider APIs. One failed
account leaves the other accounts usable. Poll cycles and storage commits are
serialized to protect newer mail and sign-out decisions.

Mail keys include provider, encoded lowercase account address, and message ID.
The cache keeps up to 200 messages within seven days. Gmail exposes unread feed
entries (roughly 20 recent messages), while Outlook queries at most four pages
of 25 recent inbox messages. These limits mean the cache is not a complete
mailbox mirror. Microsoft tokens use `chrome.storage.session`; settings and
cached mail use `chrome.storage.local`.

## Chrome acceptance

Before merging feature or bug changes, run the
[PR checklist](docs/pr-checklist.md), [popup checklist](tests/popup-checklist.md),
and, for auth changes, [manual auth checklist](docs/manual-auth.md) with real
accounts. Use two Gmail accounts and one Outlook.com account to check isolation.

After reloading the extension or restarting the browser, use **Settings → Accounts → Sign in** beside
the Outlook account, then return to Mail and press **Refresh**. Outlook credentials live in
session storage and are cleared on reload/restart; cached mail remains visible.
Being signed into Outlook in a browser tab does not restore the extension's
Graph credentials.

Verify account grouping, Mail/Settings navigation, three-line previews and hover/focus actions,
keyboard use, theme persistence, local Open/read behavior and focus preservation,
provider links, sign-in/out/removal, worker restart, badge, automatic alerts,
silent refresh, master/per-account mute, and offline/error recovery. Inspect
the popup Console and Network panel for errors and provider API requests.

Record the tested commit, Chrome version, date, results, and remaining failures
in a new acceptance record. Existing checked boxes document a historical pass
and do not establish acceptance of a new revision. Never record tokens, real
mail content, or sensitive diagnostics in the repository.

## Popup workspace

Mail shows one section per configured account, including empty or paused
accounts. All/Gmail/Outlook filters retain separate account ownership. Settings
contains Accounts, Themes, Notifications, Sound and Mail checking; Back returns to the prior
Mail scroll position. Account drafts survive cache updates and theme changes.

Click an account heading to open its webmail inbox in one new active tab.
Heading navigation does not mark mail read or refresh the cache. The encoded
Gmail/Outlook account hints still require fresh two-account compatibility
acceptance for this candidate; see the [candidate record](docs/acceptance/2026-10-02-popup-ux-settings.md).

Under **Settings → Mail checking**, enter a duration, choose seconds/minutes/hours,
and press **Save**. One preference applies to all enabled accounts. The default
is 1 minute; the supported range is 30 seconds–5 hours, in whole seconds.
Save applies the running schedule without fetching mail. Checks may be delayed
by the browser or provider; paused accounts and provider backoff still apply.
Manual Refresh remains available. Unrelated updates preserve unsaved drafts;
a failed Save retains your choice for retry and does not report success.

**Midnight desk** is the default for new or unset profiles. Choose **Slate
workspace** or **Signal panel** under Settings → Themes; the `popupTheme` local
preference survives reopen and extension reload. Existing mail, accounts and
sound preferences need no migration.

The owner superseded the earlier Gmail OAuth staging on 2026-10-01: Gmail
conversation actions use the existing session. Outlook now requests Mail.ReadWrite.
Reload the extension to grant its new cookies permission, then sign out/sign in
Outlook in Settings to renew Microsoft consent. Gmail needs no Google Cloud setup.
The [workspace specification](specs/002-popup-workspace/spec.md) records scope,
and [synthetic browser verification](docs/ui-workspace/README.md) records checks.

## Known limitations and development rules

- Outlook **Open** uses Microsoft's message `webLink` after a successful
  refresh, adding the owning account's `login_hint` for Outlook.com so the
  browser can select its mailbox. The owner passed the final two-account
  popup test on `dfbdda5` without manually switching browser accounts.
  Older cached entries use a fallback that may reach the mailbox
  without selecting the exact message. The owner confirmed exact-message Open
  after sign-in and refresh; see [the acceptance record](docs/acceptance/2026-09-30-outlook-links.md).
- The unpacked extension now has a pinned public `key`. Keep it unchanged;
  a deliberate identity migration requires a new Microsoft redirect registration
  and separate Chrome storage. [Identity setup and acceptance](docs/extension-identity.md)
  are documented; [owner acceptance](docs/acceptance/2026-09-30-extension-identity.md)
  passed on the PR #9 implementation.
- OS Do Not Disturb controls native toast visibility, but cannot reliably be
  detected for the offscreen chime. Use **Mute all sounds** when needed.
- Focused-provider alert suppression is opt-in and defaults off.

Keep changes scoped, use short-lived branches and reviewed PRs, and run
verification before submission. Do not add send scopes, permanent deletion, a backend,
analytics, or popup provider requests without an approved scope change.
Diagnostics must exclude mail content, credentials, and raw provider errors.

Read [AGENTS.md](AGENTS.md) for the repository workflow and
[the v1 design](docs/superpowers/specs/2026-09-28-gmail-outlook-extension-design.md)
for product scope. [DESIGN.md](DESIGN.md) documents the existing visual system;
[the original UI baseline](docs/ui-baseline/README.md) preserves historical
captures; [the workspace fixture](docs/ui-workspace/README.md) reuses current
production files with synthetic accounts. The original implementation plan is historical context;
current source and dated acceptance records describe the implemented behavior.

## Acknowledgements

[Checker Plus for Gmail](https://jasonsavard.com/CheckerPlusForGmail/), created
by Jason Savard, inspired me to build my own Gmail and Outlook extension.
This project uses its `sounds/chime.mp3` notification sound, bundled here as
`src/notify/sounds/chime.mp3` from Checker Plus for Gmail version 36.5.2.
The source extension's copyright notice reads: “Copyright Jason Savard”.
