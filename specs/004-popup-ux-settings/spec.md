# Capability Map: Popup UX and check frequency

**Created**: 2026-10-02
**Status**: Owner-approved specification, 2026-10-02; ready for technical planning.
Implementation remains outside the user's current authorization.
**Input**: Remove deletion Undo feedback, open account inboxes from headings,
and expose a check-frequency setting. Owner confirmed that frequency applies
to all accounts together, not individually.

| Module id | Responsibility | Depends on | Specification |
| --- | --- | --- | --- |
| delete-feedback | Remove visible Undo feedback while preserving deletion and recovery | Existing mailbox actions | [SPEC-delete-feedback.md](SPEC-delete-feedback.md) |
| account-inbox-navigation | Open the owning provider inbox from an account heading | Existing configured accounts and tab navigation | [SPEC-account-inbox-navigation.md](SPEC-account-inbox-navigation.md) |
| check-frequency | Set, remember and apply a global automatic checking interval | Existing worker polling schedule | [SPEC-check-frequency.md](SPEC-check-frequency.md) |

Suggested build order: delete-feedback → account-inbox-navigation → check-frequency.
These modules have no dependencies on one another. Order is a review suggestion,
not an approved implementation plan. Keep the existing `specs/` convention;
this map indexes the module documents and their shared engineering contract.

## Inspected baseline

- `src/popup/popup.html` defines a persistent `undo-tray` below the toolbar.
  `renderUndo()` in `src/popup/popup.js` renders both confirmed Undo entries
  and a separate unconfirmed-action recovery list. Successful Trash feedback
  explicitly advertises Undo. This is a tray, rather than a transient toast.
- `src/background/service-worker.js` owns mutations, serialization, confirmation,
  cache/badge changes and the ten-minute action journal. Gmail acts on whole
  conversations; Outlook moves individual messages to Deleted Items. Trash
  immediately hides the popup card; failures restore authoritative state.
- `renderList()` produces a plain `h2` address inside each account header.
  `src/popup/links.js` builds message URLs only. `openUrl()` already opens tabs.
  Existing message links must retain their behavior.
- The worker reads `pollIntervalMs` from local storage during initialization,
  with a 60,000ms default and 30,000–18,000,000ms limits. It creates one
  `mail-poll` alarm. There is no Settings control or live interval update handler.
- The v1 design already specifies configurable polling in that range and records
  the missing UI as a baseline gap. This module exposes that existing scope.

## Shared engineering contract

Every module specification incorporates this contract.

### Tech stack and commands

Chrome Manifest V3; plain JavaScript ES modules, HTML and CSS; Node 24;
Node's built-in test runner with `linkedom` (`^0.18.13`) for DOM tests.

```sh
nvm install 24
nvm use 24
npm ci
npm run verify
git diff --check
```

There is no build command or development server. Load the repository root as an
unpacked extension using Chrome's Extensions page. At implementation time, run
the Impeccable detector on changed popup UI files using the installed skill's
launcher; no UI detector or runtime acceptance is required for this draft alone.

### Project structure

- `src/popup/`: popup structure, presentation, settings and navigation helpers.
- `src/background/service-worker.js`: scheduling, provider operations and messages.
- `src/store/`: persistent account/cache helpers.
- `src/providers/`, `src/auth/`: provider transports and authentication.
- `tests/*.test.js`: Node unit, worker integration and synthetic DOM coverage.
- `tests/popup-checklist.md`: manual acceptance checklist.
- `specs/004-popup-ux-settings/`: this map and proposed module contracts.
- `docs/acceptance/`: fresh dated Chrome acceptance results for each candidate.
- `README.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/`: user and design
  documentation to update when behavior ships; historical records remain history.

### Code style

Follow each touched file's existing style: camelCase functions/variables,
ES module imports/exports, double-quoted strings and semicolons. Preserve local
`var` usage in the popup and `const`/`let` in helper and worker modules.
Use native HTML controls and textContent for external account/mail text.
Existing style example from `src/popup/popup.js`:

```js
var address = document.createElement("h2");
address.textContent = acct.account;
address.id = "account-heading-" + index++;
group.setAttribute("aria-labelledby", address.id);
```

### Testing strategy

Add focused behavior tests rather than tests that mirror markup alone. Run all
syntax checks and tests through `npm run verify` under Node 24. Preserve existing
provider/worker coverage; revise only popup assertions superseded by approved
requirements. No new arbitrary coverage percentage is introduced.

At implementation time, verify the actual popup with synthetic data at 320px
and 480px across Midnight, Slate and Signal, using the T3 collaborative browser
when available. Record real-account Chrome checks separately, dated for the
candidate and pending until actually performed. Synthetic URLs and DOM tests
do not prove correct provider mailbox selection or server-side deletion.

### Boundaries

- **Always:** Keep the popup cache-only, provider requests in the worker,
  account errors isolated, diagnostics content/credential-free, and current
  theme/layout identity intact. Run required checks before committing code.
- **Ask first:** Additional provider writes, permissions, dependencies, auth
  changes, per-account intervals, or expansion beyond these three modules.
- **Never:** Send mail, permanently delete mail, add analytics/backend services,
  log mail or credentials, remove unrelated failing tests, or claim historical
  acceptance establishes correctness of a new candidate.

## Requirements reconciliation

`delete-feedback` proposes superseding the visible Undo tray and promotional
copy recorded in `specs/003-mail-cards-actions/spec.md` and `DESIGN.md`. It retains
the existing worker Undo journal and restoration command. This discrepancy is
explicit: there will be no extension UI for invoking Undo; mail remains in
provider Trash/Deleted Items and can be restored using webmail.

`account-inbox-navigation` adds navigation only. It neither changes message Open
semantics nor adds support for Microsoft work/school accounts.

`check-frequency` fills the existing v1 settings gap and retains one shared alarm.

## Review state

- Owner decision: frequency is global across all accounts.
- Owner-approved UX choices: entire header is one inbox link; duration
  field plus seconds/minutes/hours selector and Save; remove all visible Undo
  feedback while retaining worker journal/recovery behavior.
- Owner approved the map and module specifications in conversation on 2026-10-02.
  Technical planning may proceed; implementation is not authorized. No approval
  request from historical Spec Kit or `.dev` artifacts applies.
