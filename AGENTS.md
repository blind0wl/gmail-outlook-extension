# Build methodology

When work is invoked, use the managed work skill as the task lifecycle owner.
Implementation is model-native and follows repository conventions and checks.
Do not activate Superpowers or another engineering workflow unless the current
user explicitly requests it. Use pbakaus/impeccable for frontend design and UX.
Load only the skills needed for the current task.

Continue from approved specifications, plans and tasks without restarting
completed design interviews or requesting approvals already given.
Historical `.dev` and Spec Kit artifacts are reference records, not an active
ai-dev-system workflow or source of mandatory routing and approval gates.


## Engineering baseline

- Development checks use Node 24 (`.nvmrc`) and `npm ci`.
- Run `npm run verify` for JavaScript syntax checks plus all tests.
- The unpacked extension loads directly from the repository root; no build
  or development server is required. Setup and architecture are in README.md.
- Keep the popup cache-only and diagnostics free of mail content and credentials.
  Provider writes are limited to the owner-approved read/Trash/Undo scope in
  specs/003-mail-cards-actions/spec.md (2026-10-01); no send or permanent delete.
  Preserve per-account error isolation.
- CI does not replace real-account Chrome acceptance. Record a new dated
  acceptance result for each feature/bug candidate; do not reuse historical ticks.
- The v1 product spec owns scope; the original plan contains historical steps.
  Capture discrepancies explicitly rather than silently changing requirements.
