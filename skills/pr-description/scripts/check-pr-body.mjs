#!/usr/bin/env node
// Checks a pull request body (and optionally its title) against the pr-description structure:
// the known sections in order (Why?, Changelog and Validation required, the rest optional, plus
// any named with --require), none empty, Conventional Commits lines in Changelog, What changed
// inside a <details> block, and task-list items in Checklist.
// Any lowercase type is accepted, as the spec allows; --types restricts them to a repo's list.
//   node <skill-dir>/scripts/check-pr-body.mjs <body.md | -> [--title "feat(x): …"] [--types feat,fix,…]
//     [--require "Dev Test,Checklist"]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const sections = [
  'Why?',
  'Impact',
  'Technical Impact',
  'Changelog',
  'What changed',
  'Validation',
  'Dev Test',
  'References',
  'Not included / follow-ups',
  'Checklist',
];
export const required = ['Why?', 'Changelog', 'Validation'];
const conventional = /^([a-z][a-z0-9-]*)(\([a-z0-9][\w./-]*\))?!?: \S/;

/** Problems with one `type(scope): description` line; `types` optionally limits the type. */
function commitProblem(line, types) {
  const type = conventional.exec(line)?.[1];
  if (!type) return 'is not Conventional Commits ("type(scope): description")';
  if (types?.length && !types.includes(type))
    return `uses type "${type}", which this repo does not allow (${types.join(', ')})`;
  return null;
}
const key = (heading) =>
  heading.trim().replace(/\?$/, '').replace(/\s*\/\s*/g, ' / ').toLowerCase();

/** Splits markdown into level-2 sections, ignoring headings inside code fences. */
function split(text) {
  const found = [];
  let fence = null;
  for (const [index, line] of text.replace(/\r\n?/g, '\n').split('\n').entries()) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
    }
    const heading = !fence && /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) found.push({ title: heading[1], line: index + 1, body: [] });
    else found.at(-1)?.body.push(line);
  }
  return found;
}

const withoutComments = (lines) => lines.join('\n').replace(/<!--[\s\S]*?-->/g, '');

export function checkPrBody(text, { types, require = [] } = {}) {
  const errors = [];
  const warnings = [];
  const found = split(text);
  const wanted = sections.map(key);
  const positions = [];
  const must = [...required, ...require].map(key);
  for (const name of require)
    if (!wanted.includes(key(name))) errors.push(`--require: unknown section "${name}"`);
  for (const name of sections) {
    const matches = found.filter((s) => key(s.title) === key(name));
    if (!matches.length && must.includes(key(name))) errors.push(`missing section "## ${name}"`);
    if (matches.length > 1) errors.push(`section "## ${name}" appears ${matches.length} times`);
    const section = matches[0];
    if (!section) continue;
    positions.push(found.indexOf(section));
    const content = withoutComments(section.body).trim();
    if (!content)
      errors.push(
        must.includes(key(name))
          ? `"## ${name}" (line ${section.line}) is empty; it is required, so say briefly why nothing applies`
          : `"## ${name}" (line ${section.line}) is empty; fill it or remove the section`,
      );
    if (/<!--/.test(section.body.join('\n')))
      warnings.push(`"## ${name}" still contains template comments; remove them`);
    if (key(name) === 'what changed' && content) {
      const block = /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/.exec(content);
      if (!block)
        errors.push('"## What changed" must put the detail in <details><summary>…</summary> … </details>');
      else {
        if (!block[1].trim()) errors.push('"## What changed": the <summary> is empty');
        if (!block[2].trim()) errors.push('"## What changed": the <details> block has no changes in it');
        else if (!/^[ \t]*\n[ \t]*\n/.test(block[2]) || !/\n[ \t]*\n\s*$/.test(block[2]))
          warnings.push('"## What changed": leave a blank line after </summary> and before </details>, or the Markdown inside will not render');
      }
    }
    if (key(name) === 'checklist' && content && !/^\s*[-*] \[[ xX]\] \S/m.test(content))
      errors.push('"## Checklist" needs task-list items ("- [x] …" or "- [ ] …")');
    if (key(name) === 'changelog' && content) {
      const items = content.split('\n').filter((l) => /^[-*] /.test(l));
      if (!items.length) errors.push('"## Changelog" needs at least one "- type(scope): …" bullet');
      for (const item of items) {
        const entry = item.slice(2).replace(/^`|`$/g, '').trim();
        const problem = commitProblem(entry, types);
        if (problem) errors.push(`Changelog entry ${problem}: "${entry.slice(0, 60)}"`);
      }
    }
  }
  if (positions.some((p, i) => i && p < positions[i - 1]))
    errors.push(`sections are out of order; use: ${sections.join(', ')}`);
  for (const s of found)
    if (!wanted.includes(key(s.title)) && positions.length && found.indexOf(s) < Math.max(...positions))
      warnings.push(`extra section "## ${s.title}" sits among the required ones; move it after "## Checklist"`);
  return { errors, warnings };
}

export function checkTitle(title, { types } = {}) {
  const problems = [];
  const problem = commitProblem(title, types);
  if (problem) problems.push(`title ${problem}: "${title}"`);
  if (title.length > 72) problems.push(`title is ${title.length} characters; keep it under about 70`);
  if (/\.$/.test(title)) problems.push('title should not end with a full stop');
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      title: { type: 'string' },
      types: { type: 'string' },
      require: { type: 'string' },
    },
  });
  if (positionals.length !== 1) {
    console.error('Usage: node <skill-dir>/scripts/check-pr-body.mjs <body.md | -> [--title "…"] [--types feat,fix,…] [--require "Dev Test,…"]');
    process.exit(1);
  }
  const text = readFileSync(positionals[0] === '-' ? 0 : positionals[0], 'utf8');
  const list = (value) => value?.split(',').map((t) => t.trim()).filter(Boolean);
  const types = list(values.types);
  const { errors, warnings } = checkPrBody(text, { types, require: list(values.require) });
  if (values.title !== undefined) errors.push(...checkTitle(values.title, { types }));
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('PR description OK.');
}
