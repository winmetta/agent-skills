#!/usr/bin/env node
// Tests and lints every skill the way the skill is written. It looks in skills/ for:
//   *.test.mjs   run together with node:test (Node 20+)
//   *.test.sh    each run with bash
//   test_*.py    run per folder with python3 -m unittest
//   *.sh         every shell script is also checked with bash -n, shellcheck and shfmt -d
// Usage: run-tests.mjs [--needs]
//   --needs  print the external tools the skills need (shellcheck, shfmt, python3), one per line,
//            and run nothing. CI uses this to install only what the skills need.
// Node 20's test runner takes file paths but no globs, so the files are listed explicitly.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const INSTALL_HINT = {
  shellcheck: 'mise use -g shellcheck   (or: brew install shellcheck)',
  shfmt: 'mise use -g shfmt   (or: brew install shfmt)',
  python3: 'mise use -g python   (or install Python 3)',
};

// Walk the folders by hand (readdirSync's recursive option needs Node 20.1+).
export const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );

export const classify = (files) => {
  const base = (f) => f.slice(f.lastIndexOf('/') + 1);
  return {
    node: files.filter((f) => f.endsWith('.test.mjs')),
    bashTests: files.filter((f) => f.endsWith('.test.sh')),
    pythonDirs: [...new Set(files.filter((f) => /^test_.*\.py$/.test(base(f))).map(dirname))],
    shell: files.filter((f) => f.endsWith('.sh')),
  };
};

export const toolsNeeded = (found) => [
  ...(found.shell.length ? ['shellcheck', 'shfmt'] : []),
  ...(found.pythonDirs.length ? ['python3'] : []),
];

const has = (tool) => spawnSync(tool, ['--version'], { stdio: 'ignore' }).status === 0;
const run = (label, cmd, args) => {
  console.log(`\n== ${label}`);
  return (spawnSync(cmd, args, { stdio: 'inherit' }).status ?? 1) === 0;
};

export const main = (argv) => {
  const found = classify(walk('skills').sort());
  const needs = toolsNeeded(found);
  if (argv.includes('--needs')) {
    for (const t of needs) console.log(t);
    return 0;
  }
  const missing = needs.filter((t) => !has(t));
  if (missing.length) {
    for (const t of missing) console.error(`Missing tool: ${t}. Install it with: ${INSTALL_HINT[t]}`);
    return 2;
  }
  const results = [];
  if (found.node.length) results.push(run('Node tests', process.execPath, ['--test', ...found.node]));
  for (const f of found.bashTests) results.push(run(`Bash test ${f}`, 'bash', [f]));
  for (const d of found.pythonDirs)
    results.push(run(`Python tests ${d}`, 'python3', ['-m', 'unittest', 'discover', '-s', d, '-p', 'test_*.py']));
  for (const f of found.shell) {
    results.push(run(`bash -n ${f}`, 'bash', ['-n', f]));
    results.push(run(`shellcheck ${f}`, 'shellcheck', ['-x', f]));
    results.push(run(`shfmt ${f}`, 'shfmt', ['-d', f]));
  }
  if (!results.length) {
    console.error('No skill tests found under skills/.');
    return 1;
  }
  return results.every(Boolean) ? 0 : 1;
};

// Compare file paths, not URLs: import.meta.url percent-encodes spaces, process.argv[1] does not.
if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) process.exit(main(process.argv.slice(2)));
