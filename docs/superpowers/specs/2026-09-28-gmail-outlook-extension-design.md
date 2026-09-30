# Gmail plus Outlook extension design

Date: 2026-09-28
Status: implemented v1; baseline documentation reconciled 2026-09-30
Scope: v1 personal use, read plus notify, no sending

## Outcome and success

Build a Chrome extension for personal daily use first. It shows Gmail plus Outlook.com mail in one popup, raises desktop alerts with sound, and opens provider tabs for actions. Success is fast triage without keeping Gmail or Outlook tabs open, with mail and tokens staying in the browser profile.

Decisions locked during brainstorming:
- Audience: personal use first
- Top feature: notifications plus badge
- Outlook scope: Outlook.com, Hotmail, and Live personal only, no M365 work accounts
- Triage depth: read only first, mark read locally, full actions in provider tabs
- Accounts: many mixed Gmail plus Outlook accounts in one list
- Compose: no sending in v1
- Style: clean minimal, direction A v5 with account top left
- Architecture: option 1, local only with two provider adapters
- Polling: alarms with 1 minute default, per account toggle, manual refresh
- Sound: gentle chime on by default for new mail, master mute plus per account toggle
- Push: deferred to v2 as optional backend, polling for v1

## Non goals for v1

No compose, reply, or send. No archive, delete, star, or spam inside the popup. No inline search. Search icon opens provider search in a tab. No M365 work or school accounts. No backend proxy. No server push. No analytics or crash reporting. No voice readout.

## UX lock

Popup follows A v5 with account top left.

Header shows Inbox plus unread count with a search icon on the right. No full search bar. Filters below header are All, Gmail, and Outlook as high contrast pills. Selected pill uses dark background with white text. Unselected pills use white background with dark text and a clear border at 13 px or larger.

Each card shows provider badge plus full account address top left, time top right, sender avatar plus dark subject plus gray snippet below. Example rows show work@gmail.com and personal@gmail.com as separate lines so All never blurs accounts. Unread carries a dot. Read rows drop the dot and use normal weight.

Contrast rules: subjects use solid dark text at full weight. Snippets use darker gray that holds apart from subjects. Pills and account lines must pass at small size.

Click behavior: select a card to read in the popup. Reading sets a local only read flag in cache. The single card action opens the provider thread in a new tab. No destructive actions in the popup. Server read state does not change in v1 because scopes stay read only.

## Architecture and components

Manifest V3, local only, no backend. Three parts:

- Service worker owns auth refresh, polling, cache writes, and notifications.
- Popup owns the inbox view and reads cache only.
- Two provider adapters sit behind one mail interface, one for Gmail session-cookie Atom feeds and one for Graph. The popup never calls provider APIs directly.

Storage stays in the browser profile. Tokens live in chrome.storage.session. Mail cache lives in chrome.storage.local with a 200 item cap and 7 day expiry. Bodies trim to snippet plus minimal preview. Logs and persisted diagnostic errors may carry ids, timestamps, a fixed operation label `op`, and numeric HTTP `status`. They must never contain mail content, tokens, request or response bodies, or exception text.

Permissions are identity, alarms, notifications, storage, offscreen, and tabs. The tabs permission is an explicit final-review amendment for reading the focused tab URL; no tab history is stored. Host access is limited to mail.google.com, graph.microsoft.com, and login.microsoftonline.com.

## Auth and accounts

Gmail uses no OAuth at all. The adapter reads the per-account Atom unread feeds with the browser session cookie, so adding an account needs only the address and a normal Gmail login, never a consent screen, client ID, or token. First sign in starts from Add Gmail or Sign in, never on launch. A lapsed session shows Sign in, which opens the Gmail login tab. No secret is bundled because none exists.

Outlook.com personal uses chrome.identity.launchWebAuthFlow with PKCE against https://login.microsoftonline.com/consumers. Scopes are User.Read plus Mail.Read plus offline_access. Entra registration is Personal Microsoft accounts only. Redirect is https://extension-id.chromiumapp.org as a public client with no secret in the bundle. Refresh tokens stay in chrome.storage.session.

Account model shares one shape: provider, account address, display name, poll toggle, notify toggle. Many mixed accounts allowed. Add, remove, sign in, and sign out per account from the popup. Sign-out writes a persistent explicit marker, invalidates pending operations, and removes only that account's session slot. Silent polling cannot reverse it. Per account errors never block other accounts.

Gmail needs no Google verification or assessment because it requests no OAuth scope. Outlook personal needs no admin consent; its delegated scopes may need Microsoft verification only if publicly listed later.

## Data flow, polling, and notifications

Flow is one way and local. Service worker wakes on alarm or manual refresh, fetches unread plus recent per account through the adapter, normalizes to id, provider, account address, from, subject, snippet, date, and read state, then writes to cache. Popup reads cache only. Selection expands the full cached subject and snippet, without bodies or new scopes, and preserves keyboard focus. The popup sends a mark-read message; the worker serializes the mutation with poll commits, persists it, and updates the badge. Polls merge new mail without clearing local read flags. Providers stay the source of truth for server unread counts until a later scope upgrade adds true mark read.

Polling uses chrome.alarms with 1 minute default, per account toggle, configurable range 30 seconds to 5 hours, plus manual refresh. 401 gets one silent token renewal and one retry. Auth and mailbox 429/5xx persist a retry deadline and failure count across worker termination. No notify on manual refresh. The popup option to skip alerts while a provider tab is focused defaults off and suppresses both toast and chime only for that provider when enabled. Cache and badge still update.

Notifications use chrome.notifications grouped per account with per account mute. Badge shows total unread across enabled accounts. Sound uses a gentle chime on by default with master mute, per account toggle, and volume setting. Sound stays silent on manual refresh. Service workers cannot play audio directly, so sound needs a small offscreen document. This stays in the implementation plan, not in popup code.

Push was investigated and deferred. Gmail push needs Cloud PubSub with users.watch plus a public HTTPS backend to receive posts and renew watch about daily. Graph push needs a public HTTPS notificationUrl with validation handshake, fast 200 or 202 response, and renewal before expiry. An extension page cannot serve either URL. Checker Plus uses the same answer: client side polling with alarms, diff of last seen ids, badge plus toast plus optional sound. V1 follows that model. A push backend can plug in later behind the same adapter interface without touching the popup.

## Privacy technical

Local only means mail content and tokens stay in the browser profile. Allowed fetch hosts are the three listed above. No custom backend or proxy. No analytics. Scopes stay least privilege with no send or write scopes.

Tokens live in chrome.storage.session and clear on sign out. Cache lives in chrome.storage.local with cap and expiry above. Diagnostic logs and errors permit only ids, timestamps, a fixed `op`, and numeric HTTP `status`; mail content, tokens, request and response bodies, and exception text are forbidden. Error messages show account address and code only.

## Error handling

Errors stay per account. 401 triggers one silent refresh then one retry, then marks that account as needs sign in with a button. 429 and 5xx use backoff and keep last cache visible with a stale label plus retry time. Offline shows cache with an offline note. Validation failures on Outlook auth surface as a sign in prompt, never as a silent loop.

## Testing and dev workflow

Testing is manual plus light automation. Manual loads unpacked in Chrome from chrome://extensions after each change, with one Gmail plus one Outlook.com account plus a second Gmail to prove the account line. Each pass checks badge, toast, sound, mute toggles, stale labels, and sign in recovery.

Automated checks cover adapter normalization, cache cap and expiry, and badge counts from fixtures, run on every PR. No real tokens in tests.

Workflow uses the existing GitHub repository, branches per change, and PR review including the Chrome acceptance checklist. Regular unpacked loads verify browser behavior. The extension loads directly from source without a build step; see README.md for setup and commands.

## Research notes

Checker Plus for Gmail polls from the browser on a configurable interval with real time best effort and 30 second fallback, background alarms, badge diffing, and toast plus sound or voice. It reads via session based feed or Gmail API, never via Gmail PubSub push to the extension. This design copies the polling shape and leaves compose and label monitoring out for v1.

Gmail reads unread sender, subject, snippet, and timestamp from the session-cookie Atom feed, about 20 recent items per account; full bodies stay in the provider tab. Outlook Graph uses delegated Mail.Read for personal accounts only. Mail.Read.Shared was rejected because it fits work accounts only.

## Final-review contract amendments, 2026-09-29

- Mail identity is `provider + ':' + encodeURIComponent(account) + ':' + messageId`. Cache, notification deduplication, and link extraction use that identity. Hydration migrates old keys while preserving localRead.
- Outlook queries inbox mail received within seven days, including read and unread items, at most four pages of 25 messages plus one profile request. Gmail probes at most ten browser-session slots and reads only unread Atom feed entries within seven days; its feed count can exceed the roughly 20 entries returned. Outlook allows up to five validated same-origin redirect hops per request. Each provider request has a 15-second deadline; Outlook's mailbox scan additionally has a 45-second deadline. Gmail has no shared scan deadline. The global cache still caps at 200 newest items and keeps the exact seven-day boundary.
- Adapters report whether the bounded query is complete. Only a successful complete snapshot removes absent cached messages for that account. Failed or capped partial snapshots preserve absent records until normal expiry or capacity pruning. Completed accounts commit independently, while poll cycles and cache/account-state writes are serialized.
- The first successful population is a quiet baseline, including an empty inbox. Automatic notifications require an enabled, notification-enabled account and a server-unread, locally unread item. Persisted per-account seen IDs prevent cache-cap eviction from causing repeated alerts. Manual refresh never alerts.
- OS DND amendment: Chrome's notifications API exposes permission level, not the OS DND state. Native toast presentation follows the OS, but the extension cannot reliably infer DND for offscreen audio. Enable Mute all sounds before using OS DND. Toasts set `silent: true`, so the separately controlled chime is the only extension sound. The earlier promise of automatic OS DND detection is withdrawn, rather than simulated with a dependency-injection flag.

The Gmail session-cookie transport supersedes the historical Gmail REST/OAuth host contract: mail.google.com replaces gmail.googleapis.com and accounts.google.com. The Web OAuth redirect does not add a fetch host permission. Microsoft OAuth pages are opened through Chrome identity, and Microsoft tokens remain in session storage.

## Baseline gaps, 2026-09-30

The header search icon described in the UX lock is not implemented. Poll interval
and account enabled/notify settings exist in worker/storage logic but are not
exposed as popup controls. These differences are recorded for scope decisions,
not treated as implemented features. Outlook exact-message links and stable
unpacked-extension identity remain outstanding reliability work.
