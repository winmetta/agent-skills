#!/usr/bin/env node
// Scaffolds a skill for both Claude Code and Codex. Refuses to overwrite anything.
// Project layout: .agents/skills/<name>/ (SKILL.md, agents/openai.yaml) and the
// .claude/skills/<name> symlink. With --catalog <dir>: <dir>/<name>/ only.
//   node <skill-dir>/scripts/new-skill.mjs <name> --description "…" --display-name "…" \
//     --short-description "…" --default-prompt 'Use $<name> to …' \
//     [--resources references,scripts,assets] [--catalog skills]
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  checkSkill,
  descriptionProblems,
  layout,
  linkTarget,
  nameProblems,
  shortDescriptionProblems,
} from './skill-rules.mjs';
import { quoteYaml } from './yaml-subset.mjs';

const usage =
  'Usage: node <skill-dir>/scripts/new-skill.mjs <name> --description "…" --display-name "…" --short-description "…" --default-prompt \'Use $<name> to …\' [--resources references,scripts,assets] [--catalog <dir>]';
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    description: { type: 'string' },
    'display-name': { type: 'string' },
    'short-description': { type: 'string' },
    'default-prompt': { type: 'string' },
    resources: { type: 'string', default: '' },
    catalog: { type: 'string' },
  },
});
const fail = (message) => {
  console.error(`${message}\n${usage}`);
  process.exit(1);
};

const name = positionals[0] ?? '';
const description = (values.description ?? '').trim();
const displayName = (values['display-name'] ?? '').trim();
const shortDescription = values['short-description'] ?? '';
const defaultPrompt = values['default-prompt'] ?? '';
const resources = values.resources
  .split(',')
  .map((resource) => resource.trim())
  .filter(Boolean);

const problems = [
  ...nameProblems(name).map((p) => `name: ${p}`),
  ...descriptionProblems(description),
  ...(displayName ? [] : ['--display-name is required']),
  ...shortDescriptionProblems(shortDescription),
  ...(defaultPrompt.includes(`$${name}`)
    ? []
    : [
        `--default-prompt must mention $${name} (use single quotes in the shell)`,
      ]),
  ...resources
    .filter((r) => !['references', 'scripts', 'assets'].includes(r))
    .map(
      (r) => `--resources: unknown "${r}" (use references, scripts, assets)`,
    ),
];
if (problems.length) fail(problems.join('\n'));

const where = layout({ catalog: values.catalog });
const dir = join(where.root, where.skillsDir, name);
const link = where.linkDir ? join(where.root, where.linkDir, name) : undefined;
if (existsSync(dir)) fail(`${where.skillsDir}/${name} already exists`);
if (link && existsSync(link)) fail(`${where.linkDir}/${name} already exists`);

mkdirSync(join(dir, 'agents'), { recursive: true });
writeFileSync(
  join(dir, 'SKILL.md'),
  `---
name: ${name}
description: ${quoteYaml(description)}
---

# ${displayName}

<!-- Imperative steps another agent can follow. Keep only what it would not know: paths,
     commands, conventions, checks and guardrails. Link to the repo's own docs (AGENTS.md)
     instead of copying its rules. Put "when to use" in the description above, not here. -->

## Steps

1. …

## Checks

- …
`,
);
writeFileSync(
  join(dir, 'agents/openai.yaml'),
  `interface:
  display_name: ${quoteYaml(displayName)}
  short_description: ${quoteYaml(shortDescription)}
  default_prompt: ${quoteYaml(defaultPrompt)}
`,
);
for (const resource of resources) mkdirSync(join(dir, resource));

if (link) {
  mkdirSync(join(where.root, where.linkDir), { recursive: true });
  symlinkSync(linkTarget(where, name), link, 'dir');
}

// The scaffold's own placeholders are expected until the author writes the body.
const errors = checkSkill(where, name).errors.filter(
  (error) => !error.includes('unfinished placeholder'),
);
console.log(
  `Created ${where.skillsDir}/${name}/ (SKILL.md, agents/openai.yaml${resources.map((r) => `, ${r}/`).join('')})`,
);
if (link)
  console.log(`Linked ${where.linkDir}/${name} -> ${linkTarget(where, name)}`);
if (errors.length) console.error(`Fix before committing:\n${errors.join('\n')}`);
console.log(
  'Next: replace the placeholders in SKILL.md, add resources, then run check-skills.mjs (it fails until the placeholders are gone). Git does not keep empty folders; remove resource folders you do not fill.',
);
