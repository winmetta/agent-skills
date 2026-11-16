// Run with: node --test skills/dependency-updates/scripts/check-versions.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { compare, isOk, readPin, report, status, validate, versionParts } from './check-versions.mjs';

test('versionParts reads the first version of a value or range', () => {
  assert.deepEqual(versionParts('24'), [24]);
  assert.deepEqual(versionParts('>=24 <25'), [24]);
  assert.deepEqual(versionParts('^3.2.1'), [3, 2, 1]);
  assert.deepEqual(versionParts('v26.13.1 (LTS Lithium)'), [26, 13, 1]);
  assert.equal(versionParts('lts'), null);
  assert.equal(versionParts(undefined), null);
});

test('readPin reads mise, .tool-versions, JSON, regex and whole-file pins', () => {
  const mise = '[tools]\nnode = "24"\n"npm:@scope/cli" = "1.2.3"\npython = { version = "3.13" }\n';
  assert.equal(readPin({ mise: 'node' }, mise), '24');
  assert.equal(readPin({ mise: 'npm:@scope/cli' }, mise), '1.2.3');
  assert.equal(readPin({ mise: 'python' }, mise), '3.13');
  assert.equal(readPin({ mise: 'nodejs' }, mise), null);
  assert.equal(readPin({ tool: 'nodejs' }, 'nodejs 24.1.0\npython 3.13.1\n'), '24.1.0');
  assert.equal(readPin({ json: ['engines', 'node'] }, '{"engines":{"node":">=24"}}'), '>=24');
  assert.equal(readPin({ json: ['devDependencies', '@types/node'] }, '{}'), null);
  assert.equal(readPin({ regex: '^FROM node:(\\S+)' }, 'FROM node:24-slim\n'), '24-slim');
  assert.equal(readPin({}, 'v24.1.0\n'), 'v24.1.0');
});

test('status compares by major, minor or the exact version', () => {
  assert.equal(status('24', 'v26.13.1', 'major'), 'behind');
  assert.equal(status('>=26 <27', 'v26.13.1', 'major'), 'current');
  assert.equal(status('27', 'v26.13.1', 'major'), 'ahead');
  assert.equal(status('3.12', '3.13.1', 'minor'), 'behind');
  assert.equal(status('3.276.0', 'v3.276.0', 'exact'), 'current');
  assert.equal(status('3.276', 'v3.276.0', 'exact'), 'current');
  assert.equal(status('3.275.0', 'v3.276.0', 'exact'), 'behind');
  assert.equal(status('lts', 'v26.13.1', 'major'), 'floating');
  assert.equal(status(null, 'v26.13.1', 'major'), 'missing');
});

test('validate reports each config problem', () => {
  assert.deepEqual(validate({ checks: [{ name: 'Node.js', latest: { source: 'node-lts' }, pins: [{ file: 'mise.toml' }] }] }), []);
  const errors = validate({
    checks: [
      { name: 'X', latest: { source: 'github-release' }, match: 'patch', pins: [{}] },
      { name: 'X', latest: { source: 'nope' }, pins: [] },
    ],
  });
  assert.equal(errors.length, 6);
  assert.match(errors.join('\n'), /used twice/);
  assert.deepEqual(validate({}), ['"checks" must be a non-empty array']);
});

const config = {
  checks: [
    {
      name: 'Node.js',
      latest: { source: 'node-lts' },
      pins: [{ file: 'mise.toml', mise: 'node' }, { file: 'package.json', json: ['engines', 'node'] }, { file: '.nvmrc' }],
    },
    { name: 'Pulumi CLI', latest: { source: 'github-release', repo: 'pulumi/pulumi' }, match: 'exact', pins: [{ file: 'mise.toml', mise: 'pulumi' }] },
  ],
};
const latest = { 'Node.js': 'v26.13.1 (LTS Lithium)', 'Pulumi CLI': 'v3.276.0' };

test('compare and report flag behind and missing pins', () => {
  const files = { 'mise.toml': '[tools]\nnode = "24"\npulumi = "3.276.0"\n', 'package.json': '{"engines":{"node":">=26"}}' };
  const readFile = (file) => {
    if (!(file in files)) throw new Error(`ENOENT ${file}`);
    return files[file];
  };
  const rows = compare(config, latest, readFile);
  assert.deepEqual(
    rows.map((r) => [r.where, r.state]),
    [
      ['mise.toml node', 'behind'],
      ['package.json engines.node', 'current'],
      ['.nvmrc', 'missing'],
      ['mise.toml pulumi', 'current'],
    ],
  );
  const text = report(rows, '2026-11-16', '.github/version-check.json');
  assert.match(text, /^2 pinned version\(s\) need attention\./);
  assert.match(text, /\| Node.js \| `mise.toml node` \| `24` \| `v26.13.1 \(LTS Lithium\)` \| \*\*behind\*\* \|/);
});

test('everything current gives a clean report', () => {
  const files = { 'mise.toml': 'node = "26"\npulumi = "3.276.0"\n', 'package.json': '{"engines":{"node":"26"}}', '.nvmrc': 'lts/*' };
  const rows = compare(config, latest, (file) => files[file]);
  assert.ok(rows.every(isOk));
  assert.match(report(rows, '2026-11-16', 'x.json'), /^All checked versions are current\./);
});
