# AGENTS.md: winmetta/agent-skills

A public catalog of agent skills that work in Claude Code, Codex and other agents, maintained by Win Metta. Every skill is useful outside any one project. A skill that only one repository needs belongs in that repository, not here.

## Layout

- `skills/<name>/`: one folder per skill (catalog layout).
  - `SKILL.md`: frontmatter `name` and `description` only. `name` equals the folder name.
  - `agents/openai.yaml`: Codex UI metadata, every string double-quoted.
  - Optional `references/`, `scripts/` and `assets/`.
- `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json`: the Claude Code marketplace `winmetta` and the plugin `agent-skills`, whose root is this repository.
- `plugin.json` and `.agents/plugins/marketplace.json`: the same plugin for Codex.
- `package.json`: scripts only (`npm test`, `npm run check`). Nothing is published to npm.

The format rules for skills, and how each tool finds and installs them, are in `skills/skill-maintainer/references/formats.md`. Follow that skill (`skills/skill-maintainer/SKILL.md`) to add or change a skill, using `--catalog skills` with its scripts.

## Adding or changing a skill

1. Branch from `main`.
2. Scaffold it: `node skills/skill-maintainer/scripts/new-skill.mjs <name> --catalog skills --description "…" --display-name "…" --short-description "…" --default-prompt 'Use $<name> to …'`.
3. Write the skill. Keep it general: no organisation-specific paths, names or rules.
4. Scripts use Node 20+ with no npm dependencies, so they run wherever the skill is installed. Give scripts `node:test` tests next to them (`*.test.mjs`).
5. Run `npm test` and `npm run check`; CI runs both and checks the plugin manifests.
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
