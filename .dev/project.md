# Project definition — gmail-outlook-extension

## Purpose and scope

Personal-first Chrome MV3 extension showing Gmail plus Outlook.com mail in one
popup, with desktop alerts, badge, and chime. Local-only, read plus notify,
no sending in v1. Mail and tokens stay in the browser profile.

Canonical product documents (linked, not copied):

- `docs/superpowers/specs/2026-09-28-gmail-outlook-extension-design.md`
- `docs/superpowers/plans/2026-09-28-gmail-outlook-extension-v1.md`
- Human gates: `docs/pr-checklist.md`, `docs/manual-auth.md`, `tests/popup-checklist.md`

Non-goals for v1: compose/send, in-popup archive/delete/star, inline search,
M365 work accounts, backend proxy/push, analytics.

## Sources

- Architecture/constitution: design spec above; derived principles —
  local-only, least-privilege read-only scopes, per-account error isolation,
  popup reads cache only, providers stay source of truth for server state.
- Active spec directory: `docs/superpowers/specs/`
- Backlog/roadmap: GitHub issues own follow-up priorities
  (https://github.com/blind0wl/gmail-outlook-extension/issues).
  Unavailable tracker data does not block status; the local index mirrors
  only what is needed for scheduling.
- Release/version source: `manifest.json` version; `main` branch;
  PR #1 squash commit `028a001`.
- Repository guidance: `AGENTS.md` (managed Flow section only; no other
  agent instructions exist in-repo).

## Canonical state writer

Writer: **dave** (repository owner). Canonical checkout/index location: the
`main` branch of https://github.com/blind0wl/gmail-outlook-extension.git.

Claimed 2026-09-29T12:00:00Z with owner approval given in chat during Flow
onboarding (owner chose "This Pi session"); provenance: Pi harness session
acting as orchestrator. Runtime/provenance identifiers never substitute for
this name. Ownership transfers require owner approval recorded here.

## Completion policy

Approved 2026-09-29 during onboarding (owner chose "Tests + human gate").
Policy revision: `.dev/verification.yaml` v2 (portable test command; same gates).

- Definition of Done: all applicable required gates in
  `.dev/verification.yaml` have current evidence; failed/blocked/not-run
  required gates prevent done; merge to `main` via PR with the human
  checklist ticked in Chrome.
- Acceptance strategy: owner smoke in Chrome with real accounts per
  `docs/pr-checklist.md`; durable acceptance note per completion.
- Baseline-failure treatment: pre-existing failures recorded separately in
  the checkpoint; new regressions block done.

## Specification maintenance

Design spec and plan stay authoritative for v1 scope. Follow-ups go to
GitHub issues; completed change history preserved via merge commits.
No living-spec split adopted.

## Open decisions

- Owner selected the focused popup usability/accessibility refinement with
  Impeccable after PR #10 merged (`e94de2e`). Scope is in
  `specs/001-popup-usability/spec.md`; no later feature selected.
- Gmail stale Open briefly displays deleted mail in Inbox while it remains
  in Trash. Recorded separately in `.specify/bugs/gmail-stale-open/assessment.md`;
  low-priority link UX follow-up, not a persistent restoration.

## Current reconciliation — 2026-09-30

The owner explicitly instructed this T3 Code Codex session to clean stale
`.dev` records. It acts on behalf of the existing durable writer **dave**;
writer identity is unchanged. No other active canonical writer is indicated.
The prior Pi claim is provenance, not a harness-specific ownership lock.

- Issues #2 and #3 are closed and their fixes merged; their historical evidence
  is preserved. Their index phases now match recorded closeout.
- The old `feat/extension-v1` branch is absent from inspected local and
  remote-tracking refs; the obsolete deletion decision is removed.
- Cleanup PR #6, baseline/README PR #7, Outlook link PR #8 (`384cd1a`), and
  stable identity PR #9 (`de47eae`) are merged with dated owner acceptance.
- README.md owns current setup/commands. DESIGN.md and docs/ui-baseline/
  describe the established popup, not a completed accessibility audit.
- Verification v2 uses `npm test`, selecting the same full suite portably on
  Node 24. Required human acceptance is unchanged. Historical evidence v1 is
  retained as history rather than rewritten to claim a new run.
- GitHub has no open issues at reconciliation. The selected popup usability
  refinement is active; the local Gmail assessment remains queued separately.
