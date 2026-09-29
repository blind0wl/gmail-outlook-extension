---
version: 1
work: issue-3
code: "c3627b8 plus dirty: .dev/evidence/issue-3-acceptance.md, .dev/evidence/issue-3-tasks.md"
requirements: "https://github.com/blind0wl/gmail-outlook-extension/issues/3, .dev/verification.yaml v1"
recorded_at: "2026-09-29T13:38:44Z"
gates:
  automated-tests:
    status: passed
    command: ["node", "--test", "tests/"]
    exit_code: 0
    summary: "152/152 passed from project root on c3627b8, fresh in-session 2026-09-29 (includes tests/account-case.test.js; verified fail pre-fix and pass post-fix)."
  human-gate:
    status: passed
    report: ".dev/evidence/issue-3-acceptance.md"
    summary: "Owner reports all checks passed except the Outlook card, tracked as outlook-deeplink. PR #5 merged as c3627b8. Acceptance report records the pass with that qualification."
---

# Checkpoint — issue-3 (case-insensitive account resolution)

## Symptom

From issue #3 (deferred from PR #1 final review): item keys embed the
provider-reported address case (e.g. feed title) while worker state keys
derive from the stored record, so a mixed-case address can miss state
lookups and lose Sign in/out/Remove controls and status rows.

## Root cause (isolated before fix)

- `accountKey` built `provider:account` with raw case, and
  `normalizeAccount` kept the stored address case, so a stored
  `Work@Gmail.com` never equaled the lifecycle handler's lowercased target
  key (`src/background/service-worker.js` lowercases `msg.account`).
  `accounts.find` missed and the handler returned not-ok for sign-in,
  sign-out, remove, and duplicate add.
- Gmail embedded the feed title address straight into items and item keys;
  Outlook embedded `me.mail ?? userPrincipalName` straight into items and
  keys. `reconcileAccount` and the poll filters compare strictly, so
  provider-case items missed stored-record keys.
- The popup built status keys with raw case from both configured accounts
  and cached items, splitting one account into two rows and missing stored
  state. Reproduced deterministically in `tests/account-case.test.js`
  (sign-out, duplicate add, and remove all failed pre-fix).

## Repair

Normalize address case at ingestion and in `accountKey`, as the issue
prescribes. Sender `from` fields untouched, identity only:

- `src/store/accounts.js`: `normalizeAccount` trims and lowercases the
  address; `accountKey` lowercases (and accepts the `address` alias).
- `src/providers/gmail.js`: `parseFeed` lowercases the feed title address;
  `normalizeGmailMessage` lowercases defensively.
- `src/providers/outlook.js`: profile address lowercased in
  `fetchOutlookMessages`; `normalizeGraphMessage` lowercases defensively.
- `src/popup/popup.js`: status row keys lowercased; display text unchanged.
- No behavior change otherwise. One concern per file, no refactoring
  bundled.

Note: Spec Kit `bug` extension is installed but the assess/fix/test
artifacts were not run; diagnosis, repair, and verification separation is
kept in this checkpoint instead.

## Verification

- `node --test tests/account-case.test.js`: 7 tests fail pre-fix on the
  lifecycle cases, pass post-fix.
- Full suite fresh in-session on the merged candidate `c3627b8`: 152/152 pass.
- Human gate passed (see gates and `.dev/evidence/issue-3-acceptance.md`).
  Owner reports all checks pass except the Outlook card, tracked as
  `outlook-deeplink`.

## Recovery / next

- Merged as PR #5 (`c3627b8`); local `fix/issue-3-account-case` branch removed.
- Safe next action: writer sets status done and commits the state update. No independent-audit gate is required by `.dev/verification.yaml` v1.

## Discovered work

- None new. `outlook-deeplink` remains queued.
