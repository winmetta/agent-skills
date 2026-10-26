# Wiring skill checks into a repository

Read this when setting up a repository to use and check shared skills. The commands below assume the project layout (`.agents/skills/`). For a skills catalog, add `--catalog skills`.

## Install this skill into a repository

```bash
npx skills@latest add winmetta/agent-skills --skill skill-maintainer -a claude-code -a codex -y
```

This writes `.agents/skills/skill-maintainer/` and the `.claude/skills/skill-maintainer` symlink. Commit both, plus any lock file the CLI writes. Update later with `npx skills update skill-maintainer`. Don't edit the installed copy; send changes upstream instead.

If the repo formats files with Prettier or similar, exclude installed third-party skills (`.agents/skills/skill-maintainer/`) so formatting never diverges from upstream. If it formats YAML with single quotes, keep `agents/openai.yaml` in double quotes, for example with this Prettier override:

```json
{ "files": "**/agents/openai.yaml", "options": { "singleQuote": false } }
```

## npm scripts (Node projects)

```json
{
  "scripts": {
    "skills:new": "node .agents/skills/skill-maintainer/scripts/new-skill.mjs",
    "skills:check": "node .agents/skills/skill-maintainer/scripts/check-skills.mjs"
  }
}
```

Pass arguments after `--`, for example `npm run skills:new -- my-skill --description "…" …`.

## Pre-commit hook

**lefthook** (`lefthook.yml`):

```yaml
pre-commit:
  commands:
    agent-skills:
      glob:
        - '.agents/skills/**'
        - '.claude/skills/**'
      run: node .agents/skills/skill-maintainer/scripts/check-skills.mjs
```

Use a list of globs. A brace pattern containing `/`, such as `{a/*,b/*}`, does not match in lefthook.

**Plain git hook** (`.git/hooks/pre-commit`, executable):

```sh
#!/bin/sh
if git diff --cached --name-only | grep -qE '^\.(agents|claude)/skills/'; then
  node .agents/skills/skill-maintainer/scripts/check-skills.mjs || exit 1
fi
```

## CI (GitHub Actions)

```yaml
- uses: actions/setup-node@<latest major>
  with:
    node-version: 24
- name: Check agent skills
  run: node .agents/skills/skill-maintainer/scripts/check-skills.mjs
```

Look up the action's latest major tag before pinning it.

## Third-party skills

Skills installed from elsewhere may use tool-only frontmatter that this check rejects. Skip the ones you don't maintain with `--ignore <name>` (repeatable), in the hook, CI and npm script alike.
