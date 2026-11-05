#!/usr/bin/env node
// Checks that files shipped in more than one skill stay identical. Each skill must work when installed on
// its own, so a shared file is copied into each skill rather than linked; this catches copies that drift.
// Edit the first file of a group, then copy it over the others.
//   node scripts/check-shared-files.mjs
import { readFileSync } from 'node:fs';
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
      if (read(copy) !== text) problems.push(`${copy} differs from ${source}; copy ${source} over it.`);
    }
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = sharedProblems();
  for (const p of problems) console.error(p);
  if (problems.length) process.exit(1);
  console.log(`Shared files OK (${SHARED.length} group${SHARED.length === 1 ? '' : 's'}).`);
}
