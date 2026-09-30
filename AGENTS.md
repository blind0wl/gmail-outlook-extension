<!-- ai-dev-system:start -->
# Managed project bootstrap

This repository is managed by ai-dev-system (Pi adapter, Phase 3).

- For status, resume, ideas, features, bugs, next work, completion checks, or onboarding, load the project skill `development-system` FIRST and follow it exactly. Inside this repository it outranks global methodology skills (brainstorming, systematic-debugging, writing-plans, using-superpowers). Those global skills must not start their own lifecycles here; they supply scoped techniques only when the project skill or selected workflow invokes them.
- The canonical project-state writer is named in `.dev/project.md`. Only that writer updates `.dev/work.yaml`. Other sessions return proposed updates.
- Reconcile `.dev` state against Spec Kit artifacts, Git state, and evidence before answering. Report contradictions; never repeat saved state blindly.
- Internal Spec Kit commands are the agent's responsibility. Do not ask the user to run them.
- Do not load brainstorming, systematic-debugging, writing-plans, test-driven-development, requesting-code-review, subagent-driven-development, executing-plans, or using-superpowers in this repository. If you already loaded one, set it aside and follow the project skill instead.
<!-- ai-dev-system:end -->

## Engineering baseline

- Development checks use Node 24 (`.nvmrc`) and `npm ci`.
- Run `npm run verify` for JavaScript syntax checks plus all tests.
- The unpacked extension loads directly from the repository root; no build
  or development server is required. Setup and architecture are in README.md.
- Keep the popup cache-only, provider access read-only, and diagnostics free
  of mail content and credentials. Preserve per-account error isolation.
- CI does not replace real-account Chrome acceptance. Record a new dated
  acceptance result for each feature/bug candidate; do not reuse historical ticks.
- The v1 product spec owns scope; the original plan contains historical steps.
  Capture discrepancies explicitly rather than silently changing requirements.
