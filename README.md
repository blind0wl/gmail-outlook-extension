# Gmail plus Outlook

A personal-use Chrome Manifest V3 extension combining Gmail and Outlook.com
mail in one popup, with an unread badge, desktop notifications, and an optional
chime. There is no backend or analytics. Mail and credentials stay in your
browser profile and are exchanged only with the providers.

The popup groups cached mail under each account. Expanding a preview displays
the cached subject and snippet without marking it read. **Open** opens the
provider message and retains the extension’s existing local read flag; server
mail remains unchanged.
Compose/send, archive/delete, search, and Microsoft work/school accounts are
outside v1.

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
| `src/providers/` | Gmail session-cookie Atom feeds and read-only Microsoft Graph mailbox queries. |
| `src/auth/` | Personal Microsoft OAuth/PKCE, renewal, and session invalidation. |
| `src/store/` | Account normalization and the bounded mail cache. |
| `src/popup/` | Cache-only rendering, provider links, and actions sent to the worker. |
| `src/notify/` | Notifications, mute/volume settings, and offscreen Web Audio chime. |
| `tests/` | Automated regressions, fixtures, and the popup acceptance procedure. |
| `.dev/`, `.specify/` | Historical workflow records and specification tooling; not an active ai-dev-system workflow. |

The worker fetches provider data, normalizes it, and writes to
`chrome.storage.local`. The popup reads that cache and sends account/refresh/
local-read messages to the worker; it never calls provider APIs. One failed
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

Verify account grouping, Mail/Settings navigation, preview-only expansion,
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
contains Themes, Accounts, Notifications and Sound; Back returns to the prior
Mail scroll position. Account drafts survive cache updates and theme changes.

**Midnight desk** is the default for new or unset profiles. Choose **Slate
workspace** or **Signal panel** under Settings → Themes; the `popupTheme` local
preference survives reopen and extension reload. Existing mail, accounts and
sound preferences need no migration.

Real mailbox read/unread, Trash and Undo actions are approved follow-up work
after the Gmail API authorization stage; this stage exposes Preview and Open.
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
verification before submission. Do not add send/write scopes, a backend,
analytics, or popup provider requests without an approved scope change.
Diagnostics must exclude mail content, credentials, and raw provider errors.

Read [AGENTS.md](AGENTS.md) for the repository workflow and
[the v1 design](docs/superpowers/specs/2026-09-28-gmail-outlook-extension-design.md)
for product scope. [DESIGN.md](DESIGN.md) documents the existing visual system;
[the original UI baseline](docs/ui-baseline/README.md) preserves historical
captures; [the workspace fixture](docs/ui-workspace/README.md) reuses current
production files with synthetic accounts. The original implementation plan is historical context;
current source and dated acceptance records describe the implemented behavior.
