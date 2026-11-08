#!/usr/bin/env node
// Checks that files shipped in more than one skill stay identical. Each skill must work when installed on
// its own, so a shared file is copied into each skill rather than linked; this catches copies that drift.
// Edit the first file of a group, then run with --fix to copy it over the others.
//   node scripts/check-shared-files.mjs [--fix]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const SHARED = [
  ['skills/local-change-review/references/review-rubric.md', 'skills/local-pr-review/references/review-rubric.md'],
];

export function sharedProblems(groups = SHARED, read = (p) => readFileSync(join(root, p), 'utf8')) {
  const problems = [];
  for (const [source, ...copies] of groups) {
    const text = read(source);
    for (const copy of copies) {
      if (read(copy) !== text) problems.push(`${copy} differs from ${source}; edit ${source}, then run: node scripts/check-shared-files.mjs --fix`);
    }
  }
  return problems;
}

// Copies the first file of each group over the copies that differ, and returns the files it wrote.
export function fixShared(groups = SHARED, read = (p) => readFileSync(join(root, p), 'utf8'), write = (p, t) => writeFileSync(join(root, p), t)) {
  const written = [];
  for (const [source, ...copies] of groups) {
    const text = read(source);
    for (const copy of copies) {
      if (read(copy) !== text) {
        write(copy, text);
        written.push(copy);
      }
    }
  }
  return written;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--fix')) for (const f of fixShared()) console.log(`Copied over ${f}`);
  const problems = sharedProblems();
  for (const p of problems) console.error(p);
  if (problems.length) process.exit(1);
  console.log(`Shared files OK (${SHARED.length} group${SHARED.length === 1 ? '' : 's'}).`);
}
