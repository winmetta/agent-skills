# AGENTS.md: winmetta/agent-skills

A public catalog of agent skills that work in Claude Code, Codex and other agents, maintained by Win Metta. Every skill is useful outside any one project. A skill that only one repository needs belongs in that repository, not here.

## Layout

- `skills/<name>/`: one folder per skill (catalog layout).
  - `SKILL.md`: frontmatter `name` and `description` only. `name` equals the folder name.
  - `agents/openai.yaml`: Codex UI metadata, every string double-quoted.
  - Optional `references/`, `scripts/` and `assets/`.
- `evals/<name>/`: optional evals for a skill (`evals.json`, `triggers.json`), kept outside the skill folder so installers don't ship them. See `skills/skill-maintainer/references/testing.md`.
- `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json`: the Claude Code marketplace `winmetta` and the plugin `agent-skills`, whose root is this repository.
- `plugin.json` and `.agents/plugins/marketplace.json`: the same plugin for Codex.
- `package.json`: scripts only (`npm test`, `npm run check`). Nothing is published to npm.

The format rules for skills, and how each tool finds and installs them, are in `skills/skill-maintainer/references/formats.md`. Follow that skill (`skills/skill-maintainer/SKILL.md`) to add or change a skill, using `--catalog skills` with its scripts.

## Adding or changing a skill

1. Branch from `main`.
2. Scaffold it: `node skills/skill-maintainer/scripts/new-skill.mjs <name> --catalog skills --description "…" --display-name "…" --short-description "…" --default-prompt 'Use $<name> to …'`.
3. Write the skill, following `skills/skill-maintainer/references/writing.md`. Keep it general: no organisation-specific paths, names or rules. Test it on realistic requests (`references/testing.md`).
4. Scripts prefer Node 20+ with no npm dependencies, so they run wherever the skill is installed. A skill may use another scripting language when that fits its subject: Bash for a Bash skill, Python for a Python skill. Write that skill's scripts and tests in that language, not as a Node wrapper around it. Whichever language you use:
   - keep dependencies to the standard library, and say in the skill which interpreter and tools it needs;
   - put tests next to the scripts, in the language's own standard test tooling: `node:test` (`*.test.mjs`) for Node, `unittest` (`test_*.py`) for Python, a plain Bash script (`*.test.sh`, exit non-zero on failure) for Bash;
   - Bash scripts use `#!/usr/bin/env bash`, stay compatible with the bash 3.2 that ships with macOS, use no GNU-only flags, and pass `bash -n`, `shellcheck` and `shfmt`; Python scripts run on the oldest Python 3 the skill states.
   - `scripts/run-tests.mjs` finds each kind of test and lints every `*.sh` file under `skills/`, so `npm test` covers all of them. CI installs only the tools the skills need (`node scripts/run-tests.mjs --needs` lists them), currently ShellCheck and shfmt when a skill has shell scripts. If a new language needs another tool, add it to the runner and the CI install step.
5. Run `npm test` and `npm run check`. CI runs the tests on Node 20 (the oldest supported version) and Node 24, runs the check, and checks the plugin manifests. Never use a test-runner glob (`node --test "**/*.test.mjs"`): Node 20 doesn't support it, which is why `scripts/run-tests.mjs` lists the files.
6. Add the skill to the list in `README.md`.
7. Open a PR. Its title follows Conventional Commits (`feat(skills): add <name>`, `fix(skills): …`, `docs: …`). PRs are squash-merged, so the title and description become the commit.

## Releases

- The plugin version is in **both** `.claude-plugin/plugin.json` and `plugin.json`, and they must match (CI checks this).
  - Bump the minor version for a new skill or a behaviour change.
  - Bump the patch version for a fix.
  - Bump the major version for a breaking change: a renamed or removed skill, or changed script flags.
- Before tagging, run `claude plugin validate .`. If a Codex CLI is available, also run `codex plugin marketplace add ./` with a throwaway `CODEX_HOME`.
- Tag `vX.Y.Z` on `main` and publish a GitHub release with notes.
- `npx skills` installs from the default branch, or a ref the user gives, so `main` must always be releasable.

## Rules

- **Public repository:** no secrets, tokens, personal data or private links, in skills, examples or tests.
- **Portability:**
  - keep frontmatter to `name` and `description` (see formats.md);
  - tool-only behaviour goes in that tool's own file (`agents/openai.yaml` for Codex);
  - never use frontmatter fields only one tool accepts.
- **Sources:** reference material records where each rule comes from and when it was checked. Re-check before changing a rule, and never copy long passages from other projects' docs.
- **Commits:** Conventional Commits. Never commit unless asked; never force-push `main`.

`CLAUDE.md` is a symlink to this file.
