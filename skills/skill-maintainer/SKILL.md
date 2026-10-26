---
name: skill-maintainer
description: Create, update, rename or remove an agent skill so it works in both Claude Code and Codex (and other agents) from one copy, with a Codex agents/openai.yaml and a .claude/skills symlink. Use when asked to add or write a skill or SKILL.md, fix or change an existing skill, set up agents/openai.yaml, make a Claude skill available to Codex or the reverse, or check a repository's skills.
---

# Skill maintainer

One copy of every skill serves every agent.

- **Project layout** (an ordinary repo, the default):
  - **Real files** go in `.agents/skills/<name>/`. Codex and most other agents read this path, and `npx skills` installs there.
  - **Claude Code** gets `.claude/skills/<name>`, a relative symlink to `../../.agents/skills/<name>`.
  - Never copy a skill into `.claude/skills/`, and never replace that symlink with a real folder.
- **Catalog layout** (a repo that publishes skills, like `winmetta/agent-skills`): skills live in one folder, usually `skills/<name>/`, with no symlinks. Pass `--catalog skills` to both scripts.

Both Claude Code and Codex follow symlinked skill folders. The format rules, the `agents/openai.yaml` fields, the install options and the sources are in [references/formats.md](references/formats.md). Read it before writing frontmatter or `openai.yaml`. To wire the checks into a repo's hooks or CI, see [references/repo-setup.md](references/repo-setup.md).

The scripts need Node 20 or later and no packages. They find the repo from the working directory, so run them from inside the repo. `<skill-dir>` below means this skill's folder, wherever it is installed. For example:
- `.agents/skills/skill-maintainer` in a project;
- `~/.agents/skills/skill-maintainer` for a global install;
- the plugin's copy.

## Create a skill

1. **Understand the use.** Get two or three concrete requests the skill should handle and what a good result looks like. Ask only for what you cannot infer, one or two questions at a time.
2. **Plan the contents.**
   - **Procedure** goes in `SKILL.md`.
   - **Lookup detail** goes in `references/*.md`, loaded only when needed.
   - **Anything that must run the same way every time** goes in `scripts/`.
   - **Files copied into output** go in `assets/`.

   Rules a repo already documents (its `AGENTS.md`, `CONTRIBUTING.md`) stay there. Link to them instead of copying them, so there is one source of truth.
3. **Scaffold it.** This creates the folder, `SKILL.md`, `agents/openai.yaml` and, in the project layout, the `.claude/skills` symlink. It refuses to overwrite anything.

   ```bash
   node <skill-dir>/scripts/new-skill.mjs <name> \
     --description "What it does. Use when …" \
     --display-name "Human Name" \
     --short-description "25 to 64 character UI blurb" \
     --default-prompt 'Use $<name> to …' \
     [--resources references,scripts,assets] [--catalog skills]
   ```

   - **`<name>`:** lowercase letters, digits and single hyphens, at most 64 characters. Prefer verb-led names (`add-blog-post`, `review-migration`).
   - **`--description`** is the trigger. Say what the skill does **and** when to use it, in the words users actually type. At most 1024 characters, with no `<` or `>`. Everything about when to use the skill goes here, not in the body, because the body loads only after the skill triggers.
   - **`--default-prompt`** must mention the skill as `$<name>`; Codex inserts it when the skill is picked from its list. Use single quotes so the shell keeps the `$`.

4. **Write the body** of `SKILL.md`:
   - imperative steps, the checks to run, and the guardrails;
   - links to `references/` files, each with a line on when to read it.

   Keep it under 500 lines, and assume the reader is a capable agent: include only what it would not know (paths, commands, conventions, pitfalls). Do not add a README, CHANGELOG or install notes inside the skill.
5. **Add resources** only if you planned them. Test every script by running it. Keep references one level deep from `SKILL.md`.
6. **Check it:**

   ```bash
   node <skill-dir>/scripts/check-skills.mjs [--catalog skills] [--ignore <name>]
   ```

   It checks every skill:
   - the frontmatter, and that the name matches the folder;
   - the description limits;
   - the `openai.yaml` fields and quoting;
   - links from `SKILL.md`;
   - in the project layout, that `.claude/skills/<name>` is the right relative symlink and that no skill exists only in `.claude/skills/`.

   It must pass. `--ignore` skips third-party skills you installed but don't maintain.
7. **Try it in both tools** when you can: `/<name>` (or the `/` menu) in Claude Code, and `$<name>` or `/skills` in Codex. A new skill may need a new session to appear.
8. **Commit** both the skill folder and, in the project layout, the `.claude/skills/<name>` symlink. Follow the repo's own commit and formatting rules.

## Update a skill

- Edit the files in the skill folder. In the project layout, editing via `.claude/skills/<name>/…` reaches the same files.
- If `description` changed, check that `agents/openai.yaml` (`short_description`, `default_prompt`) still matches. Edit it by hand, keeping every string value in double quotes.
- Run the check.
- **A skill installed from elsewhere** (with `npx skills` or as a plugin) is not yours to edit. Change it upstream, then update the installed copy, for example with `npx skills update <name>`.

## Rename or remove a skill

- **Rename:**
  1. `git mv <skills-dir>/<old> <skills-dir>/<new>`.
  2. Change `name:` in `SKILL.md` and `$<old>` in `agents/openai.yaml`.
  3. In the project layout, replace the symlink: `git rm .claude/skills/<old>`, then `ln -s ../../.agents/skills/<new> .claude/skills/<new>`.
  4. Search the repo for `<old>` (docs, other skills).
- **Remove:** `git rm -r` the skill folder and, in the project layout, its `.claude/skills/<name>` symlink. Then remove mentions of it.

## Tool-specific behaviour

Keep the `SKILL.md` frontmatter to `name` and `description` (optionally `license` and `metadata`) so every tool accepts it. If a skill needs behaviour only one tool supports, such as never triggering automatically, use that tool's own mechanism as described in [references/formats.md](references/formats.md), and say in the body what the other tool does instead.
