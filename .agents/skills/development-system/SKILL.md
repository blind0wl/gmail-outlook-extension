---
name: development-system
description: MANDATORY router for this repository. MUST load before responding to any idea, feature request, bug report, status question, resume request, next-work question, completion check, or onboarding request here. Takes precedence over brainstorming, systematic-debugging, writing-plans, test-driven-development, requesting-code-review, and using-superpowers in this repository.
---

# Development system (Pi project entrypoint)

This skill is the lifecycle owner inside this repository and takes precedence over any global methodology skills here, including brainstorming, systematic-debugging, writing-plans, test-driven-development, and using-superpowers. Those skills may supply scoped engineering techniques only when this entrypoint or the selected workflow explicitly invokes them. Never start their standalone lifecycles, spec hierarchies, or execution ledgers in this repository.

Spec Kit owns specification artifacts and native workflow execution. Do not activate any competing full lifecycle.

1. Read `AGENTS.md` in the project root for writer identity and bootstrap scope.
2. Read the package entrypoint at `/home/dave/dev/ai-dev-system/skills/development-system/SKILL.md` (absolute install path written by onboard.sh; run `cat .dev/.onboarded.json` for the recorded package location) and follow it exactly, including methodology, selected workflow, and required contracts.
3. Project state lives in this repository under `.dev/`. Reconcile it against Spec Kit artifacts, Git state, and evidence before status, resume, next-work, or completion answers.
4. Only the canonical writer named in `.dev/project.md` updates the shared index. Workers return reports. If you are not the writer, return a proposed update.
5. Never ask the user to memorize or invoke internal Spec Kit commands. Use them internally where the workflow requires; report results in ordinary language.
