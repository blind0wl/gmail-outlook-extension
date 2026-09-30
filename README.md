# Gmail plus Outlook

A personal-use Chrome Manifest V3 extension combining Gmail and Outlook.com
mail in one popup, with an unread badge, desktop notifications, and an optional
chime. There is no backend or analytics. Mail and credentials stay in your
browser profile and are exchanged only with the providers.

The popup previews cached subjects and snippets. Reading a card marks it read
locally; server mail remains unchanged. Use **Open** for actions in the provider.
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
4. Log into Gmail in a browser tab, choose **Add Gmail**, and enter that address.
   Gmail uses your existing browser session; there is no OAuth registration.
5. Choose **Add Outlook**, enter a personal Microsoft address, and complete
   consent. The developer must first register the extension's exact redirect
   URI with the Microsoft application, as described in
   [manual auth](docs/manual-auth.md).

After source changes, reload the extension from `chrome://extensions` and
reopen the popup. There is no build step or development server.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the locked development dependencies. |
| `npm test` | Run all Node tests, including the popup DOM tests. |
| `npm run check` | Parse every source, test, and tooling JavaScript file. |
| `npm run verify` | Run syntax checks and the full test suite, as CI does. |
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
| `.dev/`, `.specify/`, `.pi/` | Managed project evidence and development workflows. |

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

After reloading the extension or restarting the browser, use **Sign in** beside
the Outlook account in the popup, then **Refresh**. Outlook credentials live in
session storage and are cleared on reload/restart; cached mail remains visible.
Being signed into Outlook in a browser tab does not restore the extension's
Graph credentials.

Verify loading, filtering, keyboard navigation, local read/focus preservation,
provider links, sign-in/out/removal, worker restart, badge, automatic alerts,
silent refresh, master/per-account mute, and offline/error recovery. Inspect
the popup Console and Network panel for errors and provider API requests.

Record the tested commit, Chrome version, date, results, and remaining failures
in a new acceptance record. Existing checked boxes document a historical pass
and do not establish acceptance of a new revision. Never record tokens, real
mail content, or sensitive diagnostics in the repository.

## Known limitations and development rules

- Outlook **Open** uses Microsoft's message `webLink` after a successful
  refresh, adding the owning account's `login_hint` for Outlook.com so the
  browser can select its mailbox. The owner verified this routing in a
  controlled two-account test; final popup acceptance remains pending.
  Older cached entries use a fallback that may reach the mailbox
  without selecting the exact message. The owner confirmed exact-message Open
  after sign-in and refresh; see [the acceptance record](docs/acceptance/2026-09-30-outlook-links.md).
- The unpacked extension has no pinned public `key` yet. A changed extension ID
  requires updating the Microsoft redirect registration before sign-in works.
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
[the UI baseline](docs/ui-baseline/README.md) provides synthetic captures and
reproduction steps. The original implementation plan is historical context;
current source and dated acceptance records describe the implemented behavior.
