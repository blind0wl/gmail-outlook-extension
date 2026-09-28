# Task 9 report — Error states plus PR gate

Branch: `feat/extension-v1`. Commit: `4d4177e feat: add error states and PR gate`
(12 files, +809/−34). Working tree clean, full suite green.

## What was implemented

**1. Real Task 6 token callbacks in the worker** (`src/background/service-worker.js`,
replacing the throwing placeholder `defaultTokenProvider`, now deleted):
- `buildTokenProvider(accounts)` returns per-account `getToken`/`refreshToken`
  that call `getGmailToken(false)` for gmail and `getGraphToken(false)` for
  outlook — silent paths only, never a popup from a background poll.
- Microsoft is configured once via `configureMicrosoftAuth` with the Entra app
  id taken from the outlook account record (`getMicrosoftClientId` picks the
  first outlook record carrying `clientId`; re-configure is skipped when the id
  is unchanged; configure failures never break wiring — per-account errors
  surface at poll time).
- `handleAlarm` / `handleManualRefresh` / `start` / alarm listener all poll
  through `withRealTokens` (explicit test doubles still win via spread).
- New `handleSignIn(accounts, target, deps)` for the popup's Sign in button:
  one interactive flow (`getGmailToken(true)` / `getGraphToken(true)`), then an
  immediate silent repoll of that account only (merge + persist cache + persist
  flags). Wired to `chrome.runtime.onMessage` type `"sign-in"`.

**2. Accounts helper** (`src/store/accounts.js`, new — no more scattered keys):
`ACCOUNTS_KEY = "accounts"`, `normalizeAccount` (canonical `account`, accepts
`address` alias; `enabled`/`notify` default true; optional `clientId`),
`accountKey`, `accountAddress`, `getMicrosoftClientId`, `loadAccounts` (empty
without chrome), `saveAccounts`. The worker imports `accountKey`/`loadAccounts`
from it (re-exports `accountKey`).

**3. Richer per-account state + error classification** (worker + `src/notify/notify.js`):
- Silent token failure now marks `needsSignIn` (was: generic error).
- Fetcher errors with no HTTP status while `navigator.onLine === false` mark
  `offline` and keep the stale cache; status-less errors while online stay
  generic (existing sanitize/onError behavior preserved). Any numeric HTTP
  status clears the offline flag; `recordBackoff` and retry-success paths do too.
- Persisted `accountState` per account is now
  `{ needsSignIn, offline, backedOff, retryAt?, status? }`, merged so absent
  accounts keep their flags; `hydrateAccountState` restores `needsSignIn` and
  `offline` (backoff is transient and intentionally not restored).
- New pure helpers `formatRetryAt` (`"now"` / `"in Ns"` / clock time) and
  `accountStatusLabel` (address-plus-code lines only; extra subject/snippet
  fields ignored by design; `null` when healthy). `pollAll` summary gains
  `offline[]`; `failures`/`onError` exclude backoff, sign-in, and offline.

**4. Popup error UI** (`src/popup/popup.{js,html,css}`): new `#account-status`
section rendering one row per account with stored flags (union of configured +
cached accounts, so a row never vanishes with its messages): stale with retry
time and code, offline note, needs-sign-in with a Sign in button (sends the
`sign-in` runtime message, disables to "Signing in…", reloads flags after).
Section hides when healthy. Storage-only, `textContent` only, no network calls,
no `console`, no subject/body anywhere in error paths. Live `navigator.onLine`
forces the offline note.

**5. `package.json`** (repo root, minimal: name/private/`type: module`) —
the `MODULE_TYPELESS_PACKAGE_JSON` warning is gone from test runs.

**6. `docs/pr-checklist.md`** — the human gate: unpacked load, 2×Gmail + 1×Outlook,
badge, toast, chime + mute, stale/offline/sign-in recovery, thread links, zero
console errors, zero popup network requests, plus manual-auth Flows A/B/C. Every
browser/account step is marked human-only; the machine gate (suite, `--check`,
popup grep) is a separate section.

## TDD evidence

Wrote tests first and confirmed red: `tests/accounts.test.js` and
`tests/error-states.test.js` failed on missing modules/exports while all
pre-existing tests stayed green (22 pass / 2 fail, the 2 being the new files).
Extended `tests/notify.test.js` (401-on-one-of-three isolation) and
`tests/cache.test.js` (offline empty fetch keeps stale items) per the brief.
After implementation: `node --test tests/` → **83 pass, 0 fail** (was 67),
no `MODULE_TYPELESS_PACKAGE_JSON` warning. `node --check` passes on popup,
worker, accounts, notify. One red-herring fixed along the way: Node exposes
`navigator` as getter-only, so the offline test stubs it via
`Object.defineProperty` with descriptor restore.

## Files changed

- Modified: `src/background/service-worker.js`, `src/notify/notify.js`,
  `src/popup/popup.js`, `src/popup/popup.html`, `src/popup/popup.css`,
  `tests/notify.test.js`, `tests/cache.test.js`
- Created: `src/store/accounts.js`, `tests/accounts.test.js`,
  `tests/error-states.test.js`, `docs/pr-checklist.md`, `package.json`

## Self-review findings

- No secrets: `grep -rni "client_secret|api_key|passwd"` clean; `clientId` is the
  public Entra app id by design (documented in code + manual-auth).
- No overbroad scopes: only pre-existing "never request" cautions mention
  `Mail.Read.Shared`/send scopes; manifest untouched (gmail.readonly only).
- Sanitized errors: all new worker paths go through `sanitizeError`; labels carry
  address + numeric code only (test asserts planted subject/body strings absent).
- One account never blocks others: `Promise.all` + never-throw `pollAccount`
  unchanged; `handleSignIn` touches one account; flag persistence merges.
- Fixed before commit: `recordBackoff`/retry-success now clear the offline flag
  (an HTTP response proves online); initial commit missed `src/notify/notify.js`
  (staged + amended — HEAD stat verified to include it, tree clean).

## Issues / concerns

- Account record `clientId` (Entra app id) has no writer yet: no add/remove-account
  UI exists in v1 scope, so the id must be placed in the `accounts` storage key by
  hand or a later task. Sign-in for an outlook record without `clientId` fails
  closed ("clientId not configured") and surfaces needs-sign-in.
- Popup error UI itself is headless-untestable (DOM); covered by pure-helper tests
  plus manual PR-checklist steps. The full manual pass (badge/toast/chime/stale/
  Flows A–C) was NOT performed here — it is human-only by design.

## Fix round 1 (review findings) — commit 02a0050

All five findings addressed; suite 95/95 green, no warnings. No subagents used.

### 1. Critical — per-account token identity (service-worker.js silentTokenFor)
`chrome.identity.getAuthToken` takes no account parameter, so two Gmail
records shared the default credential. Mechanism chosen: account-bound
session records plus verification, with `launchWebAuthFlow` +
`login_hint` as the Gmail switch path (documented in `google.js` header
and `docs/manual-auth.md` "Second Gmail account").
- `google.js`: `getGmailTokenForAccount(account, interactive)` — silent
  prefers the account record/refresh token, else verifies the Chrome-cached
  token via Gmail profile email and rejects `ACCOUNT_MISMATCH` rather than
  returning a foreign credential; interactive runs the login_hint PKCE code
  flow and binds the verified result. `signInGoogleForAccount`,
  `buildGoogleAuthorizeUrl`, `parseGoogleCallback`, `googleSessionKey`.
- `microsoft.js`: per-account slots via `sessionKeyFor(account)`
  (legacy single slot unchanged); `login_hint` support in
  `buildAuthorizeUrl`; `getGraphTokenForAccount`; account binding preserved
  across refresh rotation.
- Worker passes the stable identity through `getToken`,
  `refreshToken(acct, rejectedToken)`, and `handleSignIn` interactive
  recovery. Coverage: two Gmail records across both callback paths
  (401-first, distinct creds, crossed tokens would file under one address),
  foreign-credential rejection, login_hint URL + binding assertions, and
  separate MS slots — all with stubbed identity APIs.

### 2. MS configure-before-sign-in (service-worker.js handleSignIn)
New exported `ensureMicrosoftConfigured(accounts)` (extracted from
`buildTokenProvider`) now runs before the interactive callback, so sign-in
as the first worker event no longer rejects "clientId not configured".
Covered with a fresh client id, stubbed `launchWebAuthFlow` (state echo),
and assertions on configuration, `login_hint`, and stored flags.

### 3. Forced silent renewal after 401
- `renewGmailToken`: evicts via `removeCachedAuthToken`, clears a matching
  account slot, refetches silently; throws `AUTH_REQUIRED` if the rejected
  token comes back (explicit interactive recovery via the Sign in button).
- `renewGraphToken`: bypasses the freshness check, spends the refresh
  token, preserves rotation; dead grants evict the slot, transient blips
  keep it. Covered with a rejected-but-unexpired cached token (renewed,
  never reused), a dead grant (evicted + needs-sign-in), and Chrome-cache
  eviction assertions.

### 4. Token-error classes (service-worker.js pollAccount)
Acquisition failures now classify: offline (`navigator.onLine === false`)
→ offline result with flags preserved; `transient`-marked errors → generic
error; only authentication failures mark needs-sign-in. `markNeedsSignIn`
no longer clears the offline flag; proven-online sites clear it explicitly.
Refresh-path failures classify the same way. Covered for acquisition,
renewal, and offline-with-flags-preserved cases. Existing "silent token
failure marks needs sign in" test still passes (plain errors = auth).

### 5. Stale marker for status-less online failures
`stateEntry` persists `stale: true` when a result carries an error with no
needs-sign-in/offline/backoff flags; `accountStatusLabel` renders
"<address> — stale, showing saved mail" (no retry time, no code, never raw
text). Covered end-to-end: online `TypeError` → stored marker → label
without the raw message, stale cache kept.

### Self-review (fix round)
No secrets (`client_secret` absent; ids are public identifiers), no
overbroad scopes (only pre-existing "never" cautions), popup still has no
fetch/XHR/console, error labels address-only, per-account isolation kept
(separate slots, merged flag persistence). Legacy signatures
(`getGmailToken`, `getGraphToken`, `readSessionRecord()`,
`signInMicrosoft`, `buildAuthorizeUrl`) unchanged — prior auth/notify suites
pass unmodified except two error-states tests updated for the verified
silent contract. One test-wiring bug of mine (fetch router bypassed) caught
and fixed before commit.

## Fix round 2 (re-review) — commit be3ea8d

Three open findings plus one new regression addressed; suite 105/105
green (95 prior + 10 new), no subagents used.

### 1. Microsoft token ownership check (microsoft.js signIn/tryRefresh)
`login_hint` is now a hint, not proof, mirroring Gmail: new
`getGraphAccountAddress` GETs Graph `/me` (`mail`/`userPrincipalName`,
same shape the Outlook provider already uses) and both `signInMicrosoft`
and `tryRefresh` compare against the bound address before storing,
throwing `ACCOUNT_MISMATCH` on a foreign identity with nothing written.
Legacy no-account flows skip verification, preserving existing behavior.
Coverage: sign-in completing as another address rejects and leaves the
slot empty (login_hint asserted on the wire), plus a distinct-credential
test through the real worker wiring — `buildTokenProvider(accounts)`
serving two seeded slots, no injected token callbacks.

### 2. Gmail revoked-token recovery (google.js, service-worker.js:482)
`getGmailTokenForAccount` with `interactive=true` now falls through to the
login_hint web flow on 401 from profile verification (as it already did
for mismatch), instead of rethrowing a dead token at the Sign in handler.
Transient errors still propagate untouched. Coverage: revoked token plus
401-profile reaching interactive auth with slot binding asserted, plus a
`handleSignIn` end-to-end recovery test polling with the fresh credential.

### 3. Transient taxonomy in both providers
New `isTransientStatus` (408/429/5xx) in both auth modules: `postToken`,
Google code exchange/refresh, and both profile lookups now mark transient
statuses and network/parse failures transient while 400/401/403 stay
authentication failures. `classifyRenewalError` checks `transient` first,
so forced renewal never evicts the session on 429/503 or network blips;
silent `getGraphToken(ForAccount)` rethrows transient instead of
"needs sign in"; Gmail silent preserves a transient refresh blip as the
root cause when the Chrome-cache fallback cannot help. Coverage is
end-to-end from stubbed HTTP (503/network failure at the token endpoint,
profile 429, refresh 503) through the real provider into `pollAccount`
results — generic error, no needs-sign-in, slots intact — never pre-marked
callback errors. Two round-1 tests updated to answer the new `/me` call.

### 4. Regression — sign-out clears everything
`clearGraphToken` now enumerates the session area via `get(null)` and
removes the legacy slot plus every `auth.microsoft.graph:*` slot
(fallback to legacy when enumeration is unavailable; existing
failure/missing-store tests still pass). `clearGmailToken` removes every
`auth.google.*` slot plus the Chrome-cached token, keeping its
true/false contract. Coverage: seeded legacy + per-account slots assert
every removal, then silent acquisition rejects (needs-sign-in) afterward —
previously acquired credentials are unusable post-sign-out.

### Self-review (fix round 2)
No secrets, no scope widening (only pre-existing "never" cautions), popup
still has zero fetch/XHR/console, error text stays sanitized
(address-plus-code only). Docs: manual-auth gains an Outlook ownership
section next to the Gmail switch note.

## Fix round 3 (re-review) — commit 2a560da

Four items, all in auth plus worker wiring; suite 110/110 green (105
prior + 5 new), no subagents used.

### 1. Worker-level Microsoft mismatch (was: auth-module test only)
The round-2 mismatch test called the auth module directly. New test seeds
a slot credential whose `/me` identity differs and drives `pollAccount`
through the real provider: the 401 triggers forced renewal, rotation
verifies ownership, the foreign grant is rejected — needs-sign-in set,
rotated credential never passed to a fetcher, nothing stored, mismatched
slot evicted. Silent fresh slots intentionally skip per-poll verification
(verified at store time under an account-bound key); every acquisition and
rotation re-verifies.

### 2. Gmail renewal no longer destroys sessions (google.js renewGmailToken)
Forced renewal previously wiped the slot (including the refresh grant)
before acquiring anything, so a transient 503 lost the session. Now the
stored refresh grant is spent first — the slot is rewritten only on
success — and only this account's known-rejected access token is dropped
(it can never be used again, so nothing of value is lost pre-success).
Transient refresh failure throws with the session fully retained.
Extended coverage: the refresh-503 case now also runs through `pollAccount`
with the real provider, asserting transient classification, no
needs-sign-in, and both the rejected token and refresh grant retained.

### 3. Enumeration failures reject (google.js clear, microsoft.js clear)
Both clear helpers treated an unlistable session area as success. Now a
missing `get` or a throwing `get(null)` rejects with the sanitized
sign-out failure (MS removes the legacy slot best-effort first), so
callers report incomplete sign-out instead of success over possibly usable
slots. Covered for both providers, asserting rejection plus the untouched
slot; pre-existing removal-failure/missing-store tests still pass.

### 4. Regression — split eviction interface (google.js)
`renewGmailToken` called full `clearGmailToken`, so one account's 401
wiped every Gmail slot and killed refresh-token recovery. New exported
`evictGmailToken(token)` removes a single Chrome-cached token for renewal
paths; `clearGmailToken` keeps full sign-out semantics. Coverage: two
Gmail accounts share a poll — A 401s and rotates via its own grant while
B polls untouched from its slot (Chrome cache stubbed grantless, so B
could not recover if its slot were wiped); asserts cover per-slot
contents, eviction targets, and A's rotation landing in A's slot only.

### Self-review (fix round 3)
No secrets, no scope changes, popup untouched (zero fetch/XHR/console),
error text stays sanitized. Legacy `clearGmailToken` true/false contract
preserved; MS `clearGraphToken` still resolves true on full clear.

## Fix round 4, effective Gmail 401 isolation coverage

Changed only the two-account isolation test in `tests/account-tokens.test.js`.
Account A now starts with an unexpired but server-rejected token. The existing
HTTP stub renews it successfully using A's refresh grant through the real
provider. Assertions require the fetcher to receive `bad-A` then `fresh-A`,
exactly one forced renewal for A with `bad-A`, and eviction of only `bad-A`.
The test also checks B's complete credential record and records session
mutations to prove B's slot is never written or removed.

Validation: the strengthened assertions failed with the original expired
fixture because the fetcher received only `fresh-A`. After correcting the
expiry, `node --test tests/` passed all 110 tests with zero failures, skips,
or cancellations. `git diff --check` passed. No implementation changes were
needed. Single-token renewal eviction and full sign-out remain unchanged.
No subagents were used. No new concerns; the prior manual browser gate remains
unperformed by this test-only fix.

## Final whole-branch fix wave, 2026-09-29

Status: DONE_WITH_CONCERNS. Branch: `feat/extension-v1`. Commit subject: `fix: address final extension v1 review findings`. This is the single authorized fix wave. No subagents, helpers, or reviewers were dispatched.

### Coverage by binding finding

1. **Account lifecycle.** Popup Add Gmail and Add Outlook prompt for an address and public registration client ID. Each account has Sign in, Sign out, and Remove; Refresh sends a manual poll. Worker messages validate and persist the account list. Failed sign-in leaves a recoverable row. `tests/fix-wave.test.js` exercises add, sign-out, silent-refresh prevention, and removal through the message handler. `tests/popup-ui.test.js` executes the actual popup DOM, including both add prompts, refresh, sign-out, and remove messages. Ordinary use no longer requires storage edits.
2. **Sign-out races and isolation.** `src/auth/session-guard.js` provides per-account generations captured before auth awaits and a queue shared by token writes and removals. Local signed-out markers survive worker termination and block silent reacquisition. Per-account removal does not enumerate storage or touch legacy and unrelated slots. Both providers have delayed-read and delayed-write revival regressions in `tests/session-wave.test.js`, with unrelated accounts preserved. Worker account generations also discard a poll completing after removal; the regression verifies neither cache nor account state returns.
3. **Gmail API and host contract.** The review correctly identifies `TokenDetails.account`; the prior report's claim that no account parameter exists was wrong. Chrome's current reference requires a stable account ID, not an email, and marks `getAccounts` Dev-channel-only. That does not supply a stable-channel secondary-account chooser for this address-based model. The custom chooser remains, but its unsupported code exchange is removed. A registered Google Web application client uses the documented implicit token redirect, state validation, exact redirect validation, and Gmail profile ownership verification. There is no oauth2.googleapis.com request and no added fetch host. Tests verify the Web client ID, response type, credential binding, foreign-account rejection, and absence of a token exchange. `docs/manual-auth.md` documents actual registration, sources, and the renewal limitation. No local installed Chrome docs or Chrome binary were available, so this verification used published Chrome documentation rather than an installed browser.
4. **Single cache writer.** Popup selection sends `mark-read`; only the worker mutates and persists mailCache. It serializes this with poll commits and updates the badge immediately. Tests cover the popup sending a message without a storage write, immediate badge zero, and localRead surviving the next poll.
5. **Bounded polling.** Production supplies a seven-day cutoff. Both adapters query recent inbox mail, including read and unread, with four pages of 25 maximum. Gmail is bounded to 105 requests; Outlook to five without redirects. Each request has a 15-second deadline and each mailbox scan a 45-second deadline. Outlook retains its same-origin redirect validation and five-hop limit. Results commit per account as they complete, before the overall poll summary resolves. Large mailbox fixtures assert request bounds and partial status; another test holds one account pending and observes the other account already persisted. Query and abort-signal assertions cover both adapters.
6. **Restart-safe backoff.** Account state persists retryAt and failure count and hydrates before wake-driven polling. Acquisition, renewal, and interactive auth 429/5xx use the same backoff policy as mailbox requests. Regressions cover a future persisted deadline causing zero token/fetch calls, failure-count retention, and auth 503/interactive 429 deadlines.
7. **Notification eligibility.** Toast and chime require acct.notify, server unread, locally unread, an automatic poll, and an established baseline. The first successful result, including empty, is quiet. Baseline and up to 200 seen keys per account persist. Regressions cover muted accounts, server-read messages, first population, empty baseline across restart, and cache-cap eviction not recreating new-mail alerts.
8. **Focused tabs and OS DND.** The worker checks the active tab in the focused window at notification time, after network completion. The popup suppression option defaults on and can be disabled. The tabs permission is an explicit spec/plan amendment; no tab URLs are stored and fetch hosts stay unchanged. Tests cover matching provider, unfocused window, disabling the option, and focus changing during a fetch. Chrome exposes notification permission, not OS DND. Docs explicitly amend the automatic-DND requirement and prescribe Mute all sounds. Native notifications are silent, so they cannot bypass that sound control. OS toast presentation remains governed by the OS.
9. **Overlapping polls.** Poll cycles serialize, each account compares against committed cache/seen IDs, and cache plus account-state writes use one worker queue. Two overlapping polls after baseline emit exactly one toast. Fast-account commits remain independent of a slow account's network work.
10. **Reconciliation.** Adapters mark capped results partial. A successful complete snapshot removes only that account's absent records, including complete empty snapshots. Partial results and failures preserve absent records, subject to normal cap and expiry. Tests distinguish all three outcomes. The obsolete zero-item worker test now seeds the same account and throws a real failure; cache tests no longer describe a successful empty snapshot as stale preservation.
11. **Message identity.** Keys include provider, encoded account, and message ID. Normalization, cache lookup, notification deduplication, and provider-link extraction agree. Legacy cache hydration migrates old keys and preserves localRead. Tests cover two Gmail accounts sharing a message ID, correct link extraction, and migration followed by a poll without losing localRead.
12. **Reading view.** Selection expands the full cached subject and snippet using textContent, without bodies or scopes. Selection keeps the card focused; storage-triggered rerenders restore the focused card or its Open button. DOM coverage verifies full literal text, expansion state, and retained focus. Existing keyboard tests cover card versus nested-button activation.
13. **Checklist consistency.** `tests/popup-checklist.md` now expects lifecycle buttons and per-account error states, with preview, mark-read, focused-tab, and manual-DND checks. It distinguishes removing an extension account from deleting server mail.
14. **Privacy and parked regressions.** Spec and plan explicitly permit ids, timestamps, fixed op labels, and numeric HTTP status in diagnostics, while forbidding mail content, tokens, request/response bodies, and exception text. Microsoft callback errors no longer interpolate provider-supplied error text; a regression checks this. `tests/cache.test.js` explicitly asserts localRead survival, the 200-item cap, newest-first ordering, and retention exactly at seven days followed by expiry one millisecond later.

### Verification

New missing behaviors were exercised before implementation and observed failing: account-scoped keys, mark-read message handling, lifecycle handling, first-run/muted/read notification filtering, overlapping toast deduplication, complete-snapshot reconciliation, persisted backoff, request bounds, both providers' delayed-read revival, Google implicit redirect, popup expansion, legacy-key migration, per-account removal without enumeration, cache-cap notification deduplication, focused-setting override, interactive auth backoff, silent native notifications, provider exception sanitization, and focus changing during a fetch. Existing correct cache boundary behavior was retained and given explicit assertions.

Final `node --test tests/`: **145 passed, 0 failed, 0 skipped, 0 cancelled**. All 13 source JavaScript files passed `node --check`. `git diff --check` passed. Manifest inspection verified exactly the four approved fetch hosts and the unchanged Gmail readonly scope. Popup search found no fetch, XMLHttpRequest, or console calls. Linkedom is a development-only dependency for actual popup DOM tests; it is not bundled into the extension.

### Concerns and adjudication notes

No finding was rejected or silently skipped. Finding 3 required a documented auth-contract choice because the account parameter alone does not solve stable Chrome account discovery. The old custom code-exchange tests were replaced with implicit-flow, native-renewal, expiry, ownership, and per-account isolation coverage; they were not left as tests of an unused token endpoint.

Live unpacked Chrome acceptance was not performed. Actual Google Web redirect registration, two Gmail plus one Outlook sign-in, Chrome token renewal behavior, native toasts, offscreen audio, and provider deep links remain manual acceptance gates. Web-flow Google tokens can require explicit sign-in after expiry or browser restart when Chrome cannot renew the same account. Automatic OS DND detection is unavailable and has been explicitly amended to the manual mute workaround. These limitations are stated in the spec, plan, and manual-auth guide for adjudication; there is no second fix wave.
