/**
 * Development-system router (project-scoped).
 *
 * Applies only when the current project is managed by ai-dev-system, detected
 * by the presence of .agents/skills/development-system/SKILL.md under the
 * session working directory. Appends a short precedence paragraph to the
 * system prompt so the project router wins over global methodology skills.
 * The package prompt template owns /flow and submits a normal user turn.
 *
 * No global configuration is changed. Remove this file to disable.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MARKER = ".agents/skills/development-system/SKILL.md";

const PRECEDENCE = `
PROJECT ROUTING (ai-dev-system managed project):
- This repository is managed by the development-system lifecycle. For any idea, feature request, bug report, status question, resume request, next-work question, completion check, or onboarding request, load the project skill development-system FIRST and follow it exactly.
- The project skill outranks global methodology skills here (brainstorming, systematic-debugging, writing-plans, test-driven-development, requesting-code-review, subagent-driven-development, executing-plans, using-superpowers, dispatching-parallel-agents, using-git-worktrees). Do not start their standalone lifecycles, spec hierarchies, or execution ledgers in this repository. They supply scoped techniques only when the project skill or selected workflow invokes them.
- Spec Kit owns specification artifacts and native workflow execution. Only the canonical writer named in .dev/project.md updates .dev/work.yaml.
`;

export default function developmentSystemRouter(pi: ExtensionAPI) {
	let managed = false;

	pi.on("session_start", async (_event, ctx) => {
		try {
			managed = fs.existsSync(path.join(ctx.cwd, MARKER));
		} catch {
			managed = false;
		}
	});

	pi.on("before_agent_start", async (event) => {
		if (!managed) return undefined;
		if (event.systemPrompt.includes("PROJECT ROUTING (ai-dev-system")) return undefined;
		return { systemPrompt: event.systemPrompt + "\n" + PRECEDENCE };
	});
}
