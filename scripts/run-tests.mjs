#!/usr/bin/env node
// Runs every skills/**/*.test.mjs with node:test. Node 20's test runner takes file and folder
// paths but no globs, and later versions treat a folder argument differently, so this passes
// the test files explicitly; it works the same on Node 20 and later.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Walk the folders by hand (readdirSync's recursive option needs Node 20.1+).
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name))
      : entry.name.endsWith('.test.mjs')
        ? [join(dir, entry.name)]
        : [],
  );
const files = walk('skills').sort();
if (!files.length) {
  console.error('No skills/**/*.test.mjs files found.');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
