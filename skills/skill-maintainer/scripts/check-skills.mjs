#!/usr/bin/env node
// Checks every skill against the rules both Claude Code and Codex accept. Run from anywhere in
// the repository:
//   node <skill-dir>/scripts/check-skills.mjs                    project layout (.agents/skills)
//   node <skill-dir>/scripts/check-skills.mjs --catalog skills   a skills repo (skills/<name>/)
//   … --ignore <name> [--ignore <name>]                          skip skills you do not maintain
import { parseArgs } from 'node:util';
import { checkSkill, layout, listSkills } from './skill-rules.mjs';

const { values } = parseArgs({
  options: {
    catalog: { type: 'string' },
    ignore: { type: 'string', multiple: true, default: [] },
  },
});
const where = layout({ catalog: values.catalog });
const { names, strays, evalStrays } = listSkills(where);
const ignored = new Set(values.ignore);
const errors = [];
const warnings = [];
const checked = names.filter((name) => !ignored.has(name));
for (const name of checked) {
  const result = checkSkill(where, name);
  errors.push(...result.errors);
  warnings.push(...result.warnings);
}
for (const stray of strays.filter((name) => !ignored.has(name)))
  errors.push(
    `${where.linkDir}/${stray}: no matching ${where.skillsDir}/${stray}; move the skill to ${where.skillsDir}/ and replace this with a symlink, so every agent gets it`,
  );
for (const stray of evalStrays.filter((name) => !ignored.has(name)))
  errors.push(
    `${where.evalsDir}/${stray}: no skill named ${stray}; rename or remove these evals`,
  );

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(
    '\nSkill check failed. Rules: references/formats.md in the skill-maintainer skill.',
  );
  process.exit(1);
}
console.log(
  `Skills OK (${checked.length} checked${ignored.size ? `, ${ignored.size} ignored` : ''}).`,
);
