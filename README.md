# agent-skills

Agent skills for Claude Code, Codex and other AI coding agents, from [Win Metta](https://winmetta.org). Each skill is a folder with a `SKILL.md` in the open [Agent Skills](https://agentskills.io/specification) format, written so one copy works in every agent.

## Skills

| Skill | What it does |
| --- | --- |
| [`skill-maintainer`](skills/skill-maintainer/SKILL.md) | Creates, updates, renames and checks skills so they work in both Claude Code and Codex from one copy. The real files go in `.agents/skills/<name>/` and `.claude/skills/<name>` is a symlink to them. It also writes a Codex `agents/openai.yaml`. Includes a scaffolder and a checker (Node 20+, no dependencies). |

## Install

Pick one. Review a skill before you install it: skills run with your agent's permissions.

### Into a project, for every agent (`npx skills`)

```bash
npx skills@latest add winmetta/agent-skills --skill skill-maintainer -a claude-code -a codex
```

This writes one copy to `.agents/skills/skill-maintainer/` and links `.claude/skills/skill-maintainer` to it; commit both. Leave out `--skill` to choose from the list. Add `-g` to install for your user instead of the project. Update with `npx skills update`. This uses [vercel-labs/skills](https://github.com/vercel-labs/skills).

### Claude Code plugin

```text
/plugin marketplace add winmetta/agent-skills
/plugin install agent-skills@winmetta
```

Skills from a plugin are namespaced, for example `/agent-skills:skill-maintainer`.

### Codex plugin

```bash
codex plugin marketplace add winmetta/agent-skills
```

Then install `agent-skills` from the plugin list.

## Use

- Claude Code: ask for what you need ("create a skill that …"), or run `/skill-maintainer`.
- Codex: ask, or mention `$skill-maintainer`. `/skills` lists installed skills.

To wire the skill checks into your own repository's hooks or CI, see [`references/repo-setup.md`](skills/skill-maintainer/references/repo-setup.md).

## Contributing

Issues and pull requests are welcome. See [AGENTS.md](AGENTS.md) for the layout, the rules for portable skills and how releases work. Run `npm test` and `npm run check` before opening a PR.

## Licence

MIT. See [LICENSE](LICENSE).
