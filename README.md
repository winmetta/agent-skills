# agent-skills

Agent skills for Claude Code, Codex and other AI coding agents, from [Win Metta](https://winmetta.org). Each skill is a folder with a `SKILL.md` in the open [Agent Skills](https://agentskills.io/specification) format, written so one copy works in every agent.

## Skills

| Skill | What it does |
| --- | --- |
| [`skill-maintainer`](skills/skill-maintainer/SKILL.md) | Creates, updates, improves, tests, renames and checks skills so they work in both Claude Code and Codex from one copy. The real files go in `.agents/skills/<name>/` and `.claude/skills/<name>` is a symlink to them. It also writes a Codex `agents/openai.yaml`, and guides writing, testing against a baseline, grading and description tuning. Includes a scaffolder, a checker, an eval summarizer, a trigger-test runner for the real Claude Code CLI and a grader prompt (Node 20+, no dependencies; the trigger runner needs `claude`). |
| [`bash-scripting`](skills/bash-scripting/SKILL.md) | Writes, refactors and reviews Bash scripts as small single-purpose functions with a `main` entry point, then validates and formats them with `bash -n`, ShellCheck and shfmt. If a tool is missing it tells the user how to install it. Includes a script template and a Bash validator (needs `bash`, `shellcheck` and `shfmt` on the PATH). |
| [`manage-aws-skills`](skills/manage-aws-skills/SKILL.md) | Discovers current AWS toolkit usage from official documentation and local CLI help, then selects, uses, inspects or manages AWS skills for the requested agents. Recommends essential skills by workload and asks the user to select a set instead of installing a fixed bundle. Includes nine starting candidates without freezing management commands, versions or installation paths. |
| [`pr-description`](skills/pr-description/SKILL.md) | Writes or updates a pull request or merge request title and description, on any hosting platform, with the sections Why?, Impact, Technical Impact, Changelog (Conventional Commits), What changed (collapsed), Validation, Dev Test, References, Not included / follow-ups and Checklist; only Why?, Changelog and Validation are required. It reports only checks that were actually run, keeps what people added when updating, and includes a template, an example and a checker for the structure (Node 20+, no dependencies). |
| [`local-change-review`](skills/local-change-review/SKILL.md) | Reviews local changes (code, docs, config, infrastructure etc.) before you push: uncommitted work by default, or staged changes, recent commits, a range or the whole branch when asked. Reports only problems the change introduces: bugs with a concrete failing case, broken `AGENTS.md`/`CLAUDE.md`/`CONTRIBUTING.md` rules, docs that no longer match the code, risky config and infrastructure changes, and functions made too complex, measured with the repository's own complexity tool when it has one. Formerly `local-code-review` (remove an old copy with `npx skills@latest remove -g local-code-review`). A second pass on a mid-tier model rechecks each finding before it is shown. On its own it prints the findings and changes nothing; before a commit it fixes them and reviews again until none are left. No scripts. |
| [`local-pr-review`](skills/local-pr-review/SKILL.md) | Reviews a GitHub pull request locally with Claude Code or Codex (your own subscription instead of a paid hosted reviewer), reading other local repositories for context, and posts the findings as one review from a GitHub App bot: findings on diff lines become inline threads the author must resolve, the rest go in the summary, re-runs skip findings already posted, the agent fixes the findings and reviews each push again until the bot adds a 👍 to the PR (nothing left to fix), leaving the merge to a human, and a second pass on a mid-tier model rechecks each finding and drops what it can't confirm. It uses the same rubric as `local-change-review`. Includes a headless runner, a findings schema, a review rubric and App setup steps (Node 20+, no dependencies; needs `git`, `gh` and `claude` or `codex`). |

## Install

Review a skill before you install it: skills run with your agent's permissions. There are two ways: install only the skills you want, or install them all at once as a plugin.

### Install specific skills

Uses [vercel-labs/skills](https://github.com/vercel-labs/skills) (`npx skills`, Node 20+). Replace `<skill>` with a name from the table above: `skill-maintainer`, `bash-scripting`, `manage-aws-skills`, `pr-description`, `local-change-review` or `local-pr-review`.

For Claude Code:

```bash
npx skills@latest add winmetta/agent-skills --skill <skill> -a claude-code
```

For Codex:

```bash
npx skills@latest add winmetta/agent-skills --skill <skill> -a codex
```

For both:

```bash
npx skills@latest add winmetta/agent-skills --skill <skill> -a claude-code -a codex
```

Repeat `--skill <skill>` to install several. Run with `--list` to see the available skills without installing, or leave out `--skill` to choose from the list.

- **Into the current project (default):** one copy goes to `.agents/skills/<skill>/` and `.claude/skills/<skill>` links to it. Commit both so everyone on the project gets the skill.
- **For your user, in every project:** add `-g`, for example `npx skills@latest add winmetta/agent-skills --skill local-pr-review -a claude-code -a codex -g`.
- **See, update or remove:** `npx skills@latest list`, `npx skills@latest update` (add `-g` for user-level skills) and `npx skills@latest remove <skill>`. Installed copies are snapshots, so update after a new release.

Examples:

```bash
# Only local-pr-review, for your user, in Claude Code and Codex
npx skills@latest add winmetta/agent-skills --skill local-pr-review -a claude-code -a codex -g

# Only pr-description, in this project, for Claude Code
npx skills@latest add winmetta/agent-skills --skill pr-description -a claude-code

# bash-scripting and skill-maintainer, in this project, for Codex
npx skills@latest add winmetta/agent-skills --skill bash-scripting --skill skill-maintainer -a codex
```

### Install every skill as a plugin

The repository is also a plugin, `agent-skills`, in a marketplace called `winmetta`. Installing it gives you all the skills at once, in every project, and updates follow the plugin version. A plugin cannot install a single skill: use the section above for that.

Claude Code:

```text
/plugin marketplace add winmetta/agent-skills
/plugin install agent-skills@winmetta
```

Skills from a plugin are namespaced, for example `/agent-skills:local-pr-review`.

Codex:

```bash
codex plugin marketplace add winmetta/agent-skills
```

Then install `agent-skills` from the plugin list. This channel follows OpenAI's plugin docs but hasn't been checked with the Codex CLI yet; if it fails, install the skills you want with `npx skills` above, which supports Codex.

## Use

- Claude Code: ask for what you need ("create a skill that …", "write the PR description"), or run the skill as a slash command, for example `/skill-maintainer` (`/agent-skills:skill-maintainer` when installed as the plugin).
- Codex: ask, or mention the skill, for example `$local-pr-review`. `/skills` lists installed skills.
- Some skills need tools or setup beyond the install: `bash-scripting` needs `shellcheck` and `shfmt`, and `local-pr-review` needs `git`, `gh`, a logged-in `claude` or `codex`, and a GitHub App to post reviews (a dry run works without it). Each skill's `SKILL.md` lists what it needs.

To wire the skill checks into your own repository's hooks or CI, see [`references/repo-setup.md`](skills/skill-maintainer/references/repo-setup.md).

## Contributing

Issues and pull requests are welcome. See [AGENTS.md](AGENTS.md) for the layout, the rules for portable skills and how releases work. Run `npm test` and `npm run check` before opening a PR.

## Licence

MIT. See [LICENSE](LICENSE).
