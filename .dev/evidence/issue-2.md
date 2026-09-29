---
version: 1
work: issue-2
code: "df6b209 plus dirty: .dev/evidence/issue-2-acceptance.md, .dev/evidence/issue-2-tasks.md"
requirements: "https://github.com/blind0wl/gmail-outlook-extension/issues/2, .dev/verification.yaml v1"
recorded_at: "2026-09-29T13:25:04Z"
gates:
  automated-tests:
    status: passed
    command: ["node", "--test", "tests/"]
    exit_code: 0
    summary: "145/145 passed from project root on df6b209, fresh in-session 2026-09-29 (includes tests/signin-serialization.test.js; verified fail pre-fix and pass post-fix)."
  human-gate:
    status: passed
    report: ".dev/evidence/issue-2-acceptance.md"
    summary: "Owner merged PR #4 (df6b209) and ticked docs/pr-checklist.md in 2fb487b, all except the Outlook exact-message best-effort box tracked as outlook-deeplink. Acceptance report records the pass with that qualification."
---

# Checkpoint — issue-2 (sign-in poll serialization)

## Symptom

A stale sign-in poll result could delete newer mail and re-alert when racing
an alarm poll: `handleSignIn` polled via `pollAccount` directly while
`pollAll` alarm cycles ran concurrently; the write blocks check
`accountGeneration` but neither path bumps it, so both pass and the late
stale commit wins.

## Root cause (isolated before fix)

- `pollAll` chains whole cycles on `pollTail`; `handleSignIn` never joined
  that chain — concurrent fetch+commit.
- `handleSignIn`'s commit calls
  `reconcileAccount(acct, result.items, result.items.complete !== false)`.
  Fetched arrays carry no `.complete`, so this is always a complete
  reconcile, which **deletes** cached account items absent from the stale
  set (`src/store/cache.js`). It then **replaces** `seenByKey` instead of
  union-merging like `runPoll`.
- Next alarm cycle re-fetches the deleted mail as fresh → duplicate toast
  (re-alert). Reproduced deterministically in
  `tests/signin-serialization.test.js` (failed pre-fix on "newer alarm mail
  survives the stale commit").

## Repair

`src/background/service-worker.js`: `handleSignIn` now enqueues its
recovery poll+commit (`signInPoll`) on the shared `pollTail` chain, with a
generation re-check at chain entry plus the existing write-time check.
A sign-in fetch starts only after earlier cycles committed, so its complete
reconcile is always fresh. No behavior change otherwise: still silent (no
toast), badge still computed over the full list, same return shape.
One variable changed; no refactoring bundled.

Note: Spec Kit `bug` extension is installed but the assess/fix/test
artifacts were not run; diagnosis, repair, and verification separation is
kept in this checkpoint instead.

## Verification

- `node --test tests/signin-serialization.test.js`: fails pre-fix, passes
  post-fix (stash round-trip verified 2026-09-29).
- Full suite fresh in-session on the merged candidate `df6b209`: 145/145 pass.
- Human gate environment (owner-reported 2026-09-29): Helium browser
  (Chromium). Reloading the unpacked extension generated a new extension
  ID (manifest has no pinned `key`), so the Microsoft redirect_uri was
  rejected until the owner re-registered the new URI on the Entra SPA
  blade. Gmail unaffected (session-cookie transport). Pre-existing
  environmental behavior, unrelated to this fix.
- Human gate passed (see gates and `.dev/evidence/issue-2-acceptance.md`).
  The race itself is not manually reproducible in reasonable time; the gate
  covered sign-in recovery and badge/toast regression in Chrome, with the
  Outlook exact-message best-effort item left open as `outlook-deeplink`.

## Recovery / next

- Merged as PR #4 (`df6b209`); local and remote `fix/issue-2-signin-serialization` branches removed.
- Safe next action: writer sets status done and commits the state update. No independent-audit gate is required by `.dev/verification.yaml` v1.

## Discovered work

- Pin a stable extension ID (`key` in `manifest.json`) so the Microsoft
  redirect URI survives unpacked reloads without Entra re-registration.
  Needs one final Entra update with the pinned URI. Not yet indexed; owner
  to decide branch vs separate item.
- Outlook card Open doesn't select the message (human gate 2026-09-29,
  Helium). Proven out of issue-2 scope: branch changes only
  service-worker.js + test + .dev records; popup/link code identical to
  v1. Diagnosis: id extraction and encoding verified correct through the
  real `threadUrl()` builder; slot-`0` variant fails identically, ruling
  out the account-in-path segment. Adapter `$select` omits `webLink`, so
  the popup constructs `/mail/0/inbox/id/{rest-id}` which OWA ignores for
  this mailbox. Proposed fix (separate item `outlook-deeplink`): request
  `webLink` in `$select`, store on normalized item, prefer it in
  `threadUrl()` with constructed route as fallback.
