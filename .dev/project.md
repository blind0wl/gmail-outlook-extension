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
Policy revision: `.dev/verification.yaml` v1.

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

- `feat/extension-v1` branch is un-deleted but fully contained in `main`
  (squash `028a001`; verified identical trees 2026-09-29). Delete it or keep
  as history? Pending owner call.
- Issues #2 (poll serialization) and #3 (account-case keys) queued; order
  and scope decided at next-work selection.
