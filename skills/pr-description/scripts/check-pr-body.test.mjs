import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkPrBody, checkTitle } from './check-pr-body.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const skill = join(here, '..');
const example = readFileSync(join(skill, 'references/example.md'), 'utf8').match(
  /```markdown\n([\s\S]*?)\n```/,
)[1];
const cli = (args, input) =>
  spawnSync(process.execPath, [join(here, 'check-pr-body.mjs'), ...args], {
    input,
    encoding: 'utf8',
  });

describe('checkPrBody', () => {
  it('accepts the example in references/example.md', () => {
    assert.deepEqual(checkPrBody(example), { errors: [], warnings: [] });
  });
  it('rejects the unfilled template', () => {
    const template = readFileSync(join(skill, 'assets/pr-body-template.md'), 'utf8');
    const { errors, warnings } = checkPrBody(template);
    assert.equal(errors.filter((e) => e.includes('is empty')).length, 7);
    assert.equal(warnings.length, 7);
  });
  it('finds missing, duplicate, misordered and empty sections', () => {
    const body = example
      .replace(/## Dev Test\n\n[\s\S]*?\n(?=## )/, '## Dev Test\n\n<!-- later -->\n\n')
      .replace(/## References[\s\S]*$/, '')
      .replace('## Impact', '## Validation\n\n- ran it\n\n## Impact');
    const errors = checkPrBody(body).errors.join('\n');
    assert.match(errors, /missing section "## References"/);
    assert.match(errors, /"## Validation" appears 2 times/);
    assert.match(errors, /out of order/);
    assert.match(errors, /"## Dev Test" .* is empty/);
  });
  it('requires Conventional Commits bullets in Changelog', () => {
    const body = example.replace(
      '- test(checkout):',
      '- Updated tests\n- `docs: note the key`\n- security(auth): rotate keys\n- Fix(x): nope\n- test(checkout):',
    );
    const errors = checkPrBody(body).errors;
    assert.equal(errors.length, 2, errors.join('\n'));
    assert.match(errors.join('\n'), /"Updated tests"[\s\S]*"Fix\(x\): nope"/);
    const limited = checkPrBody(body, { types: ['feat', 'fix', 'docs', 'test'] }).errors.join('\n');
    assert.match(limited, /uses type "security", which this repo does not allow/);
    assert.match(
      checkPrBody(example.replace(/## Changelog\n\n[\s\S]*?\n(?=## )/, '## Changelog\n\nSome prose.\n\n')).errors.join('\n'),
      /needs at least one/,
    );
  });
  it('ignores headings in code fences, allows "Why", and warns about extra sections in the middle', () => {
    const body = example
      .replace('## Why?', '## Why')
      .replace('## Validation', '## Screenshots\n\nnone\n\n```md\n## Changelog\n```\n\n## Validation')
      .concat('\n## Checklist\n\n- [x] done\n');
    const { errors, warnings } = checkPrBody(body);
    assert.deepEqual(errors, []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /"## Screenshots" sits among/);
  });
});

describe('checkTitle', () => {
  it('checks Conventional Commits form and length', () => {
    assert.deepEqual(checkTitle('feat(api)!: drop v1 endpoints'), []);
    assert.deepEqual(checkTitle('docs: fix typo'), []);
    assert.deepEqual(checkTitle('deps(api): bump client'), [], 'any lowercase type by default');
    assert.match(checkTitle('deps(api): bump client', { types: ['feat', 'fix'] })[0], /does not allow/);
    for (const bad of ['Add feature', 'Feat: capital type', 'feat:missing space', 'fix(x): ends with a stop.', `feat: ${'x'.repeat(80)}`])
      assert.notDeepEqual(checkTitle(bad), [], bad);
  });
});

describe('check-pr-body.mjs', () => {
  it('reads stdin and exits 0 or 1', () => {
    const ok = cli(['-', '--title', 'fix(checkout): stop double charges'], example);
    assert.equal(ok.status, 0, ok.stderr);
    const bad = cli(['-', '--title', 'Stop double charges'], example);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /title is not Conventional Commits/);
    const typed = cli(['-', '--title', 'deps: bump', '--types', 'feat, fix'], example);
    assert.equal(typed.status, 1);
    assert.match(typed.stderr, /title uses type "deps"/);
    assert.equal(cli([], '').status, 1);
  });
});
