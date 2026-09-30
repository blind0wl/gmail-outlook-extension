# Gmail plus Outlook Constitution

This document records existing project principles from `.dev/project.md` and
the v1 design spec. It adds no new product scope or completion gate.

## Core Principles

### I. Local-only, personal-account scope

Mail, settings, and credentials stay in the browser profile. Provider requests
go directly to Gmail or Microsoft; there is no backend, analytics, or proxy.
V1 supports Gmail and personal Outlook.com accounts, with read plus notify
behavior. Sending and in-popup server mutations are outside scope.

### II. Least privilege and safe diagnostics

Gmail uses the existing session-cookie Atom feed without OAuth tokens.
Microsoft uses personal-account OAuth with PKCE, no client secret, and delegated
`User.Read`, `Mail.Read`, and `offline_access`. Tokens use session storage.
Diagnostics exclude credentials, mail content, response bodies, and raw
provider exception text. External mail renders as text, not injected HTML.

### III. Clear ownership and account isolation

The worker owns authentication, polling, serialized storage writes, badge, and
notification dispatch. The popup reads cached mail and sends actions to the
worker; it never fetches provider APIs. Each account's failures, credentials,
backoff, and sign-out state remain isolated from the other accounts.

### IV. Providers own server state

Mail identity includes provider, normalized account address, and message ID.
Local read flags survive cache merges without changing provider mail. The cache
retains up to 200 messages within seven days. A failed or partial snapshot must
not delete absent cached messages. Serialized work must respect newer state and
account/session invalidation.

### V. Evidence before completion

Run the applicable gates in `.dev/verification.yaml`. Tests use fixtures and
Chrome substitutes; real-account Chrome acceptance is required for feature and
bug work. Historical checked boxes are not acceptance of a new candidate.
Changes land through reviewed PRs to `main`. Failed or unrun required gates
remain visible and prevent a completion claim.

## Governance

The repository's development-system skill owns lifecycle routing, Spec Kit owns
specification artifacts, and the canonical writer named in `.dev/project.md`
owns shared project state. The v1 design and approved amendments own product
scope; plans and dated evidence supply implementation and verification context.
Changes to scope, principles, or gate policy require explicit owner approval.

**Version**: 1.0.0 | **Ratified**: existing project decisions, 2026-09-29 |
**Documented**: 2026-09-30
