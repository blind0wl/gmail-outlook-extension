# Project architecture — gmail-outlook-extension

## Purpose
Chrome MV3 extension ("Gmail plus Outlook"): one popup for personal Gmail +
Outlook.com mail. Local-only: no backend, no analytics. Popup shows cached
mail grouped per account; service worker polls providers, writes cache, owns
badge/toast/chime. See `PRODUCT.md`, `README.md`, `DESIGN.md`.

## Architecture and components
Plain JS ES modules + HTML/CSS. No framework, bundler, or production deps
(dev-only `linkedom` for DOM tests). Unpacked extension loads from repo root.

| Path | Responsibility |
| --- | --- |
| `manifest.json` | MV3 manifest; pinned dev `key`; `src/popup/popup.html`, `src/background/service-worker.js` |
| `src/background/service-worker.js` | Alarms, serialized poll/writes, account lifecycle, badge/toast, mailbox actions, poll-interval alarm |
| `src/providers/gmail.js` | Session-cookie Atom feed reads (`mail.google.com/.../feed/atom`, slots 0–9); unread-only |
| `src/providers/outlook.js` | Graph inbox reads (delegated `Mail.Read`, ≤4×25 msgs); allowlisted Graph origin only |
| `src/providers/mail-actions.js` | Gmail conversation + Outlook message read/unread/Trash mutations |
| `src/providers/gmail-*.js` | Conversation state, Trash verification, Undo (Sync restore), reply helpers |
| `src/auth/microsoft.js` | PKCE OAuth (consumers), session-storage tokens, renewal/invalidation; `Mail.ReadWrite` |
| `src/auth/session-guard.js` | Session helpers |
| `src/store/accounts.js` | `accounts` key owner; normalized `{provider, account, enabled?, notify?, clientId?}` |
| `src/store/cache.js` | In-memory merge; keys `provider:encodedAccount:id`; ≤200 msgs, 7-day expiry; `localRead` survives merge |
| `src/store/poll-settings.js` | Shared poll-interval preference + strict duration parsing (30s–5h, whole seconds) |
| `src/popup/` | Cache-only render (`popup.js`), links (`links.js`), themes (`themes.js`), poll form/presets, `popup.css` |
| `src/notify/` | `notify.js` (persist/cache/account-state/labels), `sound.js`, offscreen MP3 chime |
| `tests/` | Node:test suite + fixtures; popup DOM tests via linkedom; checklists (`popup-checklist.md`) |
| `specs/` | 001 popup-usability, 002 popup-workspace, 003 mail-cards-actions, 004 popup-ux-settings (+ per-topic SPECs) |
| `docs/acceptance/` | Dated owner acceptance records (authoritative for behavior claims) |

## Data flows and integrations
- Worker polls Gmail (browser session cookies, `credentials:include`) and
  Outlook (Graph bearer token via `buildTokenProvider`; silent + renew), normalizes,
  `mergeMessages` → `chrome.storage.local.mailCache`; per-account flags →
  `accountState`. Serialized poll/storage commits protect newer mail/sign-out.
- Popup reads `mailCache`/`accounts`/`accountState` only; never calls provider
  APIs. Sends `chrome.runtime` messages (account/refresh/local-read/mailbox-action/sign-in).
- Gmail: unread feed entries only (~20 recent); absence ≠ Trash proof (mixed-folder
  risk — see specs/003 + acceptance 2026-10-01 series). Whole-conversation actions.
- Outlook: per-message actions; Open uses `webLink` + `login_hint`.
- Worker 10-min Undo journal survives popup close; uncertain writes lock only the
  affected conversation/message, fail closed, grouped per-account recovery UI.

## Build, test and lint
Verified (ran 2026-10-04, box Node v26.10.0): `node --test "tests/*.test.js"` →
346 pass. Documented baseline is Node 24 (`.nvmrc`); CI runs `npm run verify`
(= `check` syntax/identity + full tests). Commands:
- `npm ci` — locked dev deps. `npm test` — full suite. `npm run check` —
  `node --check` all JS + identity. `npm run verify` — check + tests (CI gate).
- `git diff --check` — whitespace. No lint/typecheck configured.
- Chrome acceptance (owner, real accounts: 2×Gmail + 1×Outlook): `docs/pr-checklist.md`,
  `tests/popup-checklist.md`, `docs/manual-auth.md`; record dated result per
  candidate in `docs/acceptance/`. CI ≠ real-account acceptance.

## Conventions and constraints
- Scoping: short-lived branches + reviewed PRs; `npm run verify` before submit.
- Popup stays cache-only; diagnostics exclude mail content/credentials/raw errors
  (allowlisted `op/status/id/account` only).
- Provider writes limited to approved read/Trash/Undo scope (specs/003, 2026-10-01);
  no send, permanent delete, backend, analytics, popup provider calls.
- Per-account error isolation: one failed account never hides others.
- Owner-approved visuals: Midnight desk (default) / Slate workspace / Signal panel;
  normal-case UI typography; account-owned cards; staged 5s read grace; Trash =
  concise success, no Undo tray. Latest: `PRODUCT.md` 2026-10-03 polish + dated records.
- Reload/restart clears Outlook session tokens (re-sign-in), cache persists.

## Significant architectural decisions
- Gmail via private session-cookie Atom (owner rejected Google Cloud/OAuth setup);
  confirmation requires exact conversation membership + labels, fail-closed.
- Outlook `Mail.ReadWrite` (was Read); Gmail needs no setup beyond browser login.
- Pinned manifest `key` → stable extension ID/redirect; migration is one-time,
  documented in `docs/extension-identity.md`.
- Staged specs superseded in place: specs/004 + PRODUCT.md "candidate" notes own
  current scope; older staged/preview text is historical. Dated acceptance records
  override recollection; never reuse historical ticks for a new candidate.

## Unknowns / pending (2026-10-04)
- Branch cleanup completed 2026-10-04 (commit `a590468` + task record
  `tasks/branch-cleanup.md`): 6 merged branches + all T3 worktrees + stale
  stash removed; only `main` / origin/HEAD / origin/main remain. Badge owner
  note preserved in `docs/acceptance/2026-10-03-count-badges.md`. Stale
  `fix/current-main-outlook-diagnostics` (HTTP-status label fallback +
  branch-only popup test) dropped per owner decision, not tracked.
- Fresh real-account acceptance pending for visual-polish candidate
  (`docs/acceptance/2026-10-03-visual-polish.md`) and earlier popup-UX candidate.
- `HANDOFF-optimistic-read.md` (PR #25 worktree) is stale vs current main
  (grace-period read + polish shipped differently); treat as reference only.
- Box Node is v26 vs repo Node 24: tests passed here, but `npm run verify`
  under Node 24 is still the authoritative gate.
