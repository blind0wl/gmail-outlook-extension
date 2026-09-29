---
version: 1
work: issue-3
code: "cb8669d plus dirty: src/store/accounts.js, src/providers/gmail.js, src/providers/outlook.js, src/popup/popup.js, tests/account-case.test.js, .dev/work.yaml"
requirements: "https://github.com/blind0wl/gmail-outlook-extension/issues/3, .dev/verification.yaml v1"
recorded_at: "2026-09-29T13:33:19Z"
gates:
  automated-tests:
    status: passed
    command: ["node", "--test", "tests/"]
    exit_code: 0
    summary: "152/152 passed from branch fix/issue-3-account-case (145 existing + 7 new tests/account-case.test.js). New tests verified to fail on pre-fix code and pass with the fix."
  human-gate:
    status: not-run
    summary: "Owner Chrome pass per docs/pr-checklist.md (sign-in recovery, badge/toast) still required before done."
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
- Full suite fresh in-session: 152/152 pass.
- Human gate outstanding (see gates). Case handling itself is covered
  headless; the gate covers sign-in recovery and badge/toast regression in
  Chrome.

## Recovery / next

- Safe next action: push branch, open PR, owner runs the human gate; on
  pass, refresh evidence to the merged candidate and run closeout.
- Work is on `fix/issue-3-account-case` (repo convention: branches per
  change).

## Discovered work

- None new. `outlook-deeplink` remains queued.
