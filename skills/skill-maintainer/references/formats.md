# Skill formats for Claude Code and Codex

Checked on 2026-10-25 (sources added 2026-10-26) against the sources at the end. Re-check them before relying on a detail that may have changed (field names, paths, limits).

## Contents

1. Where each tool looks
2. `SKILL.md` frontmatter
3. `agents/openai.yaml` (Codex)
4. Tool-only features and how to handle them
5. Invoking a skill
6. Installing and sharing skills
7. Sources

## 1. Where each tool looks

|                           | Codex                                                                            | Claude Code                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Repository skills         | `.agents/skills/<name>/SKILL.md`, from the working directory up to the repo root | `.claude/skills/<name>/SKILL.md`, from the working directory up to the repo root                                                         |
| Personal skills           | `~/.agents/skills/`                                                              | `~/.claude/skills/`                                                                                                                      |
| Symlinks                  | Followed ("Codex supports symlinked skill folders")                              | Followed ("a `<skill-name>` entry … can be a symlink to a directory elsewhere on disk"); a target reached from several places loads once |
| Other files in the folder | Read when the instructions point to them                                         | Not loaded automatically; read when `SKILL.md` points to them; scripts are run, not loaded                                               |

Older guides mention `.codex/skills/`; that path is out of date. Neither tool searches above the repo root, so a skill must live in each repo that needs it.

**The layout this skill uses:** the real folder `.agents/skills/<name>/`, plus `.claude/skills/<name>` → `../../.agents/skills/<name>` (relative, so it works in every clone). `npx skills add` installs skills the same way. `check-skills.mjs` enforces it.

## 2. `SKILL.md` frontmatter

The open Agent Skills specification (agentskills.io), which Codex builds on and Claude Code follows:

| Field           | Required | Rule                                                                                                                   |
| --------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `name`          | yes      | 1–64 characters: `a-z`, `0-9`, `-`; no leading, trailing or double hyphen; **equals the folder name**                  |
| `description`   | yes      | 1–1024 characters; what the skill does and when to use it                                                              |
| `license`       | no       | short licence name or bundled file                                                                                     |
| `metadata`      | no       | string-to-string map for your own tooling                                                                              |
| `allowed-tools` | no       | experimental; meaning differs between tools                                                                            |
| `compatibility` | no       | in the spec and accepted by Claude Code, but **rejected** by OpenAI's `skill-creator` validator, so do not use it here |

Extra constraints from OpenAI's `skill-creator` validator (`quick_validate.py`): only `name`, `description`, `license`, `allowed-tools`, `metadata` are allowed, and the description may not contain `<` or `>`. Claude Code ignores unknown fields; Codex's validator does not. **So write only `name` and `description`**, plus `license`/`metadata` if needed. The frontmatter must start on the file's first line.

Description tips (both tools choose skills from `name` + `description` only, before reading the body):

- Lead with what it does, then "Use when …" with the phrases users type.
- Name the domain's own nouns (blog post, migration, release) so the right skill wins. More in [writing.md](writing.md).
- Keep "when to use" out of the body.

## 3. `agents/openai.yaml` (Codex)

Optional, Codex-only, read by the app ("for the machine/harness to read, not the agent"). Claude Code ignores it. OpenAI's `skill-creator` recommends it for every skill.

<!-- prettier-ignore -->
```yaml
interface:
  display_name: "Human-facing title"
  short_description: "UI blurb, 25 to 64 characters"
  default_prompt: "Use $skill-name to do the common task."
  icon_small: "./assets/small-400px.png" # only if provided
  icon_large: "./assets/large-logo.svg" # only if provided
  brand_color: "#356A82" # only if provided

policy:
  allow_implicit_invocation: false # default true; false = only an explicit $skill-name runs it

dependencies:
  tools:
    - type: "mcp" # the only supported type
      value: "github"
      description: "GitHub MCP server"
      transport: "streamable_http"
      url: "https://api.githubcopilot.com/mcp/"
```

Rules (from `skill-creator`'s `references/openai_yaml.md` and the Codex docs):

- Quote every string value (double quotes, as OpenAI's generator writes them; `.prettierrc.json` keeps them for `**/agents/openai.yaml`); keep keys unquoted.
- `default_prompt` is one short sentence and names the skill as `$skill-name`.
- Add icons or `brand_color` only when the user supplies them (assets go in the skill's `assets/`).
- Keep it in step with `SKILL.md` when the skill changes.

## 4. Tool-only features and how to handle them

| Need                                                                | Codex                                                      | Claude Code                                                              | In this repo                                                                                                                                                                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run only when asked by name                                         | `policy.allow_implicit_invocation: false` in `openai.yaml` | `disable-model-invocation: true` in frontmatter                          | Use the Codex setting; for Claude, add a line at the top of the body ("Only follow this skill when the user asks for it by name"). The Claude field would break the portable frontmatter. |
| Pre-approved tools                                                  | none                                                       | `allowed-tools`                                                          | Leave out; tool names differ between products.                                                                                                                                            |
| Argument hints, model, effort, forked subagent, hooks, path filters | none                                                       | `argument-hint`, `model`, `effort`, `context: fork`, `hooks`, `paths`, … | Leave out unless a Claude-only skill is explicitly wanted (then it is not shared; say so in the repo's docs).                                                                                   |
| MCP server the skill needs                                          | `dependencies.tools` in `openai.yaml`                      | configured outside the skill                                             | Declare it in `openai.yaml` and name it in the body.                                                                                                                                      |

Claude Code also caps `description` (plus `when_to_use`) at 1,536 characters in its listing; the spec's 1024 limit is stricter, so follow that.

## 5. Invoking a skill

- Codex: picked automatically from the description, or explicitly with `$skill-name` or the `/skills` list.
- Claude Code: picked automatically from the description, or explicitly with `/skill-name`.
- After adding a skill, start a new session if it does not show up.

## 6. Installing and sharing skills

| Way | Command | Where it lands | Notes |
| --- | --- | --- | --- |
| `npx skills` (vercel-labs/skills, MIT) | `npx skills add owner/repo [--skill <name>] -a claude-code -a codex [-g] [-y]` | Project: one copy in `.agents/skills/<name>/`, symlinked from `.claude/skills/<name>` (or `--copy`). Global with `-g`. | Finds skills in a repo's `skills/<name>/SKILL.md` (and other common folders). Update with `npx skills update [<name>]`. Use `npx skills@latest` to avoid a stale cached version. |
| Claude Code plugin marketplace | `/plugin marketplace add owner/repo`, then `/plugin install <plugin>@<marketplace>` | Per user, in Claude's plugin cache | Needs `.claude-plugin/marketplace.json` and a plugin with `.claude-plugin/plugin.json` and `skills/`. Plugin skills are namespaced: `/<plugin>:<skill>`. Check with `claude plugin validate <dir>`. |
| Codex plugin | `codex plugin marketplace add owner/repo`, then install from the plugin list | Per user, in Codex's plugin cache | A portable plugin has a root `plugin.json` and `skills/`; a repo marketplace is `.agents/plugins/marketplace.json`. Codex also reads `.claude-plugin/marketplace.json`. |
| Checked into a repo | commit the skill folder | `.agents/skills/` (+ the Claude symlink) | Everyone working in the repo gets it. |

A skill that only one repo needs (its own conventions) belongs in that repo. A skill useful anywhere belongs in a shared skills repo, installed with one of the ways above.

## 7. Sources

- OpenAI, Build skills (Codex): https://learn.chatgpt.com/docs/build-skills (formerly developers.openai.com/codex/skills)
- OpenAI `skill-creator` (system skill; `SKILL.md`, `references/openai_yaml.md`, `scripts/quick_validate.py`, `scripts/generate_openai_yaml.py`): https://github.com/openai/skills/tree/main/skills/.system/skill-creator (Apache-2.0; read at commit 4ab6e0f, 2026-02-09)
- Anthropic `skill-creator` (`SKILL.md`, `references/schemas.md`, `agents/grader.md`, `agents/comparator.md`, `agents/analyzer.md`): https://github.com/anthropics/skills/tree/main/skills/skill-creator (Apache-2.0; read 2026-10-26). Source of the testing, grading, improvement and description-tuning ideas in writing.md and testing.md, which paraphrase it; the `grading.json` field names match it.
- OpenAI `skill-creator`, current `SKILL.md` (principles on scope, freedom, progressive disclosure and forward-testing, and the TODO-placeholder check) and `skill-installer` (read 2026-10-26).
- Agent Skills specification: https://agentskills.io/specification
- Claude Code, Skills: https://code.claude.com/docs/en/skills
- Claude Code, plugin marketplaces: https://code.claude.com/docs/en/plugin-marketplaces
- Codex, build a plugin: https://developers.openai.com/codex/plugins/build
- `npx skills`: https://github.com/vercel-labs/skills (docs/creating-skills.md, docs/agents.md, docs/commands.md)
