# Architecture

Gmail plus Outlook is a Chrome Manifest V3 extension. The unpacked extension
runs directly from the repository root. It uses JavaScript ES modules, HTML,
and CSS, with no bundler or production dependencies.

## Runtime boundaries

| Area | Responsibility |
| --- | --- |
| `manifest.json` | Extension permissions, popup, module service worker, and pinned unpacked ID. |
| `src/background/service-worker.js` | Poll scheduling, provider requests, message-body loading, account lifecycle, badge and alert updates, serialized mailbox actions. |
| `src/providers/` | Gmail session-feed reads and conversation operations; Outlook Graph reads and per-message actions. |
| `src/auth/` | Microsoft PKCE sign-in, silent renewal, and session invalidation. |
| `src/store/` | Account state, poll settings, message normalization, and bounded cache. |
| `src/popup/` | Cache-driven account, mail, reader, and settings views; requests work through extension messages. |
| `src/notify/` | Desktop notifications and the offscreen chime. |
| `tests/` | Automated regressions, fixtures, and the popup checklist. |
| `specs/`, `docs/acceptance/` | Approved product scope and dated verification records. |

The worker is the only component that calls mail providers. It normalizes
provider results and writes them to `chrome.storage.local`; the popup renders
that cache and sends worker messages for refreshes, account changes, message
bodies, and mailbox actions. Polling and storage updates are serialized so a
late request cannot overwrite newer state or a sign-out. Errors are isolated
per account.

## Provider and data behavior

Gmail reads the signed-in browser session through the private Atom feed
protocol. The feed contains a bounded set of recent unread messages, not a
complete mailbox. Gmail reads, Trash verification, and restoration also depend
on private session endpoints. Actions target the complete conversation and
verify membership and state before reporting success. The protocol is
unsupported and may change without notice.

Outlook.com uses delegated Microsoft Graph access for personal Microsoft
accounts. It queries at most four pages of 25 recent inbox messages and performs
read/Trash actions on individual messages. The worker limits Graph requests to
the approved origin and validates message ownership against the connected
account.

The cache key includes provider, normalized account address, and provider
message ID. It retains up to 200 messages for seven days; this is a working
view, not a complete mailbox mirror. Account settings, preferences, and cached
mail use `chrome.storage.local`. Outlook access and refresh tokens use
`chrome.storage.session`, which clears on extension reload or browser restart.
After restart the extension attempts one hidden sign-in using the current
Microsoft browser session. If that fails, the account asks the user to sign in.
Gmail cookies are used for provider requests but are not copied into extension
storage. Full message bodies are fetched on demand and held only while the
popup is open.

The reader sanitizes HTML into an isolated frame with scripts, forms, embeds,
external stylesheets, and unsafe URLs removed. Credential-free HTTPS images
load from their remote hosts, with no referrer; these requests can expose access
to those hosts. Attachment images and unsupported image URLs remain
placeholders.

## Mail actions

Opening a provider link updates only the extension's local read state. Expanding
an unread card stages a provider read; leaving the card starts a five-second
grace period, while an outside click commits immediately. Hover and keyboard
focus pause the timer; Mark unread or Trash cancels a staged read. Provider
operations fail closed when state or ownership cannot be confirmed. Uncertain
actions lock only the affected item and require checking the mailbox before
recovery actions unlock. Writes are never retried automatically.

Trash moves mail to the provider's recoverable Trash folder and never
permanently deletes it. Confirmed Trash has no visible Undo control. A
short-lived worker restore journal supports the existing restore command;
uncertain results remain visible as account-specific recovery rows. Send,
compose, archive, and search operations are outside scope. Diagnostics contain
no mail content, credentials, or raw provider errors.

## Verification

Development uses Node 24 (`.nvmrc`). `npm run verify` runs syntax and pinned
identity checks plus the full test suite; CI runs the same command. Automated
tests use fixtures and Chrome API substitutes and do not establish live
provider acceptance. Use the checklists in `docs/pr-checklist.md`,
`tests/popup-checklist.md`, and `docs/manual-auth.md`, and record a new dated
result in `docs/acceptance/` for each candidate. See [PRODUCT.md](PRODUCT.md)
for the current user-facing behavior and approved scope.
