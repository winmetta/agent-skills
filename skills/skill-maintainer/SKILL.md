---
name: skill-maintainer
description: Create, update, improve, test, rename or remove an agent skill so it works in both Claude Code and Codex (and other agents) from one copy, with a Codex agents/openai.yaml and a .claude/skills symlink. Use when asked to add or write a skill or SKILL.md, turn a workflow into a skill, fix, change or improve an existing skill, test a skill or tune its description so it triggers, set up agents/openai.yaml, make a Claude skill available to Codex or the reverse, or check a repository's skills.
---

# Skill maintainer

One copy of every skill serves every agent.

- **Project layout** (an ordinary repo, the default):
  - **Real files** go in `.agents/skills/<name>/`. Codex and most other agents read this path, and `npx skills` installs there.
  - **Claude Code** gets `.claude/skills/<name>`, a relative symlink to `../../.agents/skills/<name>`.
  - Never copy a skill into `.claude/skills/`, and never replace that symlink with a real folder.
- **Catalog layout** (a repo that publishes skills, like `winmetta/agent-skills`): skills live in one folder, usually `skills/<name>/`, with no symlinks. Pass `--catalog skills` to both scripts.

Both Claude Code and Codex follow symlinked skill folders. References, each read only when needed:

- [references/formats.md](references/formats.md): the format rules, the `agents/openai.yaml` fields, install options and sources. Read it before writing frontmatter or `openai.yaml`.
- [references/writing.md](references/writing.md): what makes a skill good (the description, the body, resources, scope and safety). Read it before drafting or reworking a skill.
- [references/testing.md](references/testing.md): running a skill on realistic requests, grading, improving from feedback, and tuning the description. Read it before testing or improving a skill.
- [references/repo-setup.md](references/repo-setup.md): wiring the checks into a repo's hooks or CI.

The scripts need Node 20 or later and no packages. They find the repo from the working directory, so run them from inside the repo. `<skill-dir>` below means this skill's folder, wherever it is installed. For example:
- `.agents/skills/skill-maintainer` in a project;
- `~/.agents/skills/skill-maintainer` for a global install;
- the plugin's copy.

## Create a skill

1. **Understand the use.** Get two or three concrete requests the skill should handle and what a good result looks like. If the user says "turn this into a skill", take the steps, commands, corrections and formats from the conversation first and ask them to confirm. Otherwise ask only for what you cannot infer, one or two questions at a time. Check whether a skill for this already exists; update it rather than adding a second.
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

4. **Write the body** of `SKILL.md`, following [references/writing.md](references/writing.md):
   - imperative steps, the checks to run, and the guardrails, with the reason for any rule that isn't obvious;
   - the gotchas the agent would otherwise get wrong;
   - links to `references/` files, each with a line on when to read it.

   Replace every scaffold placeholder (`1. …`, `- …`, the comment). Keep it well under 500 lines, and assume the reader is a capable agent: include only what it would not know (paths, commands, conventions, pitfalls). Do not add a README, CHANGELOG or install notes inside the skill.
5. **Add resources** only if you planned them. Write and run scripts before the steps that use them. Keep references one level deep from `SKILL.md`.
6. **Check it:**

   ```bash
   node <skill-dir>/scripts/check-skills.mjs [--catalog skills] [--ignore <name>]
   ```

   It checks every skill:
   - the frontmatter, and that the name matches the folder;
   - the description limits;
   - the `openai.yaml` fields and quoting;
   - links from `SKILL.md`, leftover scaffold placeholders, and (as a warning) `references/` files nothing mentions;
   - the eval files, if any (see [references/testing.md](references/testing.md));
   - in the project layout, that `.claude/skills/<name>` is the right relative symlink and that no skill exists only in `.claude/skills/`.

   It must pass. `--ignore` skips third-party skills you installed but don't maintain.
7. **Test it** on two or three realistic requests, as in [references/testing.md](references/testing.md), and fix what goes wrong. Scale this to the skill: a small one needs a quick try, one that many people use or that changes files or systems needs evals with a baseline.
8. **Try it in both tools** when you can: `/<name>` (or the `/` menu) in Claude Code, and `$<name>` or `/skills` in Codex. A new skill may need a new session to appear.
9. **Commit** both the skill folder and, in the project layout, the `.claude/skills/<name>` symlink (and its evals, if any). Follow the repo's own commit and formatting rules.

## Update or improve a skill

- **Read the whole skill first**, including its references and scripts, and find what uses each part before removing it.
- **Keep the `name`, folder and invocation policy** unless the user asks to change them; don't create `<name>-v2`.
- **For more than a small fix, snapshot it first** (copy the folder to a scratch workspace), so you can compare the old and new versions on the same requests.
- Edit the files in the skill folder. In the project layout, editing via `.claude/skills/<name>/…` reaches the same files.
- Make the narrowest change that fixes the cause. Generalize from feedback instead of adding a rule per complaint; [references/testing.md](references/testing.md) has the improvement loop and description tuning.
- If `description` changed, check that `agents/openai.yaml` (`short_description`, `default_prompt`) still matches. Edit it by hand, keeping every string value in double quotes and leaving `policy` and `dependencies` as they are.
- Run the check, and rerun the skill's evals if it has any.
- **A skill installed from elsewhere** (with `npx skills` or as a plugin) is not yours to edit. Change it upstream, then update the installed copy, for example with `npx skills update <name>`.

## Rename or remove a skill

- **Rename:**
  1. `git mv <skills-dir>/<old> <skills-dir>/<new>`.
  2. Change `name:` in `SKILL.md` and `$<old>` in `agents/openai.yaml`.
  3. In the project layout, replace the symlink: `git rm .claude/skills/<old>`, then `ln -s ../../.agents/skills/<new> .claude/skills/<new>`.
  4. Rename its evals folder, if any, and change `skill_name` in `evals.json`.
  5. Search the repo for `<old>` (docs, other skills).
- **Remove:** `git rm -r` the skill folder, its evals folder and, in the project layout, its `.claude/skills/<name>` symlink. Then remove mentions of it. Confirm with the user before deleting.

## Tool-specific behaviour

Keep the `SKILL.md` frontmatter to `name` and `description` (optionally `license` and `metadata`) so every tool accepts it. If a skill needs behaviour only one tool supports, such as never triggering automatically, use that tool's own mechanism as described in [references/formats.md](references/formats.md), and say in the body what the other tool does instead.
