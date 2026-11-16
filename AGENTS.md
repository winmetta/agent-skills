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
5. Run `npm test` and `npm run check`. A file that more than one skill ships (for example the review rubric in `local-change-review` and `local-pr-review`) is copied into each, because each skill must work when installed alone; `scripts/check-shared-files.mjs` lists them and `npm run check` (which CI runs) fails if the copies differ. Edit the first copy, then run `node scripts/check-shared-files.mjs --fix` to copy it over the others. A symlink would not work: a skill installed alone with `npx skills` would get a link to a folder that isn't there. CI runs the tests on Node 20 (the oldest supported version) and Node 24, runs the check, and checks the plugin manifests. Never use a test-runner glob (`node --test "**/*.test.mjs"`): Node 20 doesn't support it, which is why `scripts/run-tests.mjs` lists the files.
6. Bump the plugin version in **both** `plugin.json` files in the same PR, following the rules under Releases. Docs-only or CI-only changes need no bump.
7. Add the skill to the list in `README.md`.
8. Open a PR. Its title follows Conventional Commits and ends with the head branch in square brackets (`feat(skills): add <name> [feat/add-<name>]`, `fix(skills): … [fix/…]`, `docs: … [docs/…]`); GitHub then appends the PR number. PRs are squash-merged, so the title and description become the commit.
9. After it merges, install or refresh the skill on your own machine so your agents use what is on `main`. Copies installed with `npx skills` in `~/.agents/skills/<name>/` (linked from `~/.claude/skills/<name>`) are snapshots and do not follow the repository:
   - a new skill: `npx skills@latest add winmetta/agent-skills --skill <name> -a claude-code -a codex -g`;
   - a changed skill: `npx skills@latest update -g`.

   Keep the installed copy made by `npx skills`; don't replace it with a symlink to this checkout, which would make every agent session use whatever branch is checked out. To try a change before it merges, use the checkout's copy directly, for example `node skills/skill-maintainer/scripts/run-triggers.mjs skills/<name> …` or the scripts under `skills/<name>/scripts/`.

## Releases

- The plugin version is in **both** `.claude-plugin/plugin.json` and `plugin.json`, and they must match (CI checks this). Every PR that changes an installed skill bumps it (step 6 above); tagging only publishes the version already on `main`.
  - Bump the minor version for a new skill or a behaviour change.
  - Bump the patch version for a fix.
  - Bump the major version for a breaking change: a renamed or removed skill, or changed script flags.
- **Finish the distribution follow-up after each merged skill change.** A merge, a GitHub release, and a local installation update are separate outcomes. Prepare the release below and report any step left pending; do not describe refreshing an installed skill as publishing a release. Docs-only and CI-only changes that do not change an installed skill need no new release.
- **Release authorization:** publishing a tag or GitHub release requires an explicit user request covering that release. A request to commit, push or open and merge a PR does not by itself authorize a release. Prepare the exact version, source commit and release notes first, then request authorization if it is missing. Do not retag or replace an existing published release.

### Publish a GitHub release

1. Work from a clean checkout of the updated default branch after the PR has merged. Confirm the bot reviewed the merged PR head and CI passed. Record the release commit SHA; do not release from an unmerged feature branch.
2. Read the version from both plugin manifests and confirm they match. Check existing tags and GitHub releases with `gh release list --repo winmetta/agent-skills` and `git ls-remote --tags origin`. If that version already exists, inspect its target and contents; do not overwrite it or silently publish a different commit under it. Resolve a needed version bump through the normal PR process.
3. Run `npm test`, `npm run check` and `claude plugin validate .` on the release commit. Validate both marketplace manifests and their plugin paths. If Codex is available, check its current `plugin marketplace` help and validate local marketplace registration using an isolated test configuration; do not replace the developer's configured marketplace with a local checkout. Report missing validation tools or failures before publishing.
4. Prepare release notes describing the installed-skill changes since the previous published release, including breaking changes and validation. Use a file for the notes. Publish only after release authorization is present. Create and push `vX.Y.Z` at the verified release SHA, using the repository's verified remote; never force-push a tag. Then run `gh release create vX.Y.Z --repo winmetta/agent-skills --verify-tag --target RELEASE_SHA --title vX.Y.Z --notes-file NOTES_FILE`, substituting the actual version, SHA and notes path.
5. Verify the published release URL, tag target, version and notes against the intended commit. Link the release in the completion reply and state any remaining distribution or local-update steps.

### Make the update available to Codex and Claude Code

Both plugin marketplaces are hosted by **this GitHub repository**: `.agents/plugins/marketplace.json` for Codex and `.claude-plugin/marketplace.json` for Claude Code. Their entries resolve the plugin from this repository's root. Pushing the reviewed change to the default branch updates their source; publishing a GitHub release records a versioned release. There is no separate plugin upload or push to an OpenAI or Anthropic repository in this setup. Submission to an official vendor directory is a separate action and must not be claimed unless it was actually completed.

- Keep both marketplace entries and both plugin manifests valid in the same PR as a skill addition or change. A new skill under `skills/` is shipped by the existing plugin; an existing skill's fix ships through the same channel.
- For an existing **Claude Code plugin installation**, refresh the configured marketplace with `claude plugin marketplace update winmetta`, then update the installed plugin with `claude plugin update agent-skills@winmetta`. Verify the resulting version and restart the client when required. Check CLI help first if the installed version uses different commands.
- For an existing **Codex plugin installation**, use `codex plugin marketplace upgrade winmetta` to refresh the configured Git marketplace snapshot, then inspect the plugin manager and apply any offered plugin update. Verify the installed version; a successful marketplace refresh alone does not prove the installed plugin was updated. Check current CLI help instead of inventing an upload or plugin-update command.
- Update only channels already installed or explicitly requested. Do not install the whole plugin when the developer only uses individually installed skills. `npx skills` reads the default branch unless a ref was specified, so a GitHub release is not needed for it to see a merged change. Follow step 9 above to add a new skill or refresh existing snapshots, and refresh repository-installed copies in their own clean checkouts under their own review/commit rules.
- Report source publication, GitHub release publication and local installation status separately. If a release or client update is not authorized or cannot be verified, name the pending step instead of saying distribution is complete.

Command syntax and distribution behavior checked on 2026-11-16 against local CLI help, [OpenAI plugin documentation](https://developers.openai.com/plugins/build/plugins) and [Claude Code marketplace documentation](https://code.claude.com/docs/en/plugin-marketplaces). Recheck before changing the workflow.

## Rules

- **Public repository:** no secrets, tokens, personal data or private links, in skills, examples or tests.
- **Portability:**
  - keep frontmatter to `name` and `description` (see formats.md);
  - tool-only behaviour goes in that tool's own file (`agents/openai.yaml` for Codex);
  - never use frontmatter fields only one tool accepts.
- **Sources:** reference material records where each rule comes from and when it was checked. Re-check before changing a rule, and never copy long passages from other projects' docs.
- **Commits:** Conventional Commits. Never commit unless asked; never force-push `main`.
