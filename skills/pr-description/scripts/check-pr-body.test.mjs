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
    assert.equal(errors.filter((e) => e.includes('is empty')).length, 9, errors.join('\n'));
    assert.match(errors.join('\n'), /<details> block has no changes in it/);
    assert.equal(warnings.length, 10, warnings.join('\n'));
  });
  it('requires only Why?, Changelog and Validation, plus --require', () => {
    const minimal = example.match(/## Why\?[\s\S]*?(?=## Impact)/)[0] +
      example.match(/## Changelog[\s\S]*?(?=## What changed)/)[0] +
      example.match(/## Validation[\s\S]*?(?=## Dev Test)/)[0];
    assert.deepEqual(checkPrBody(minimal), { errors: [], warnings: [] });
    const errors = checkPrBody(minimal, { require: ['Dev Test', 'Nope'] }).errors.join('\n');
    assert.match(errors, /missing section "## Dev Test"/);
    assert.match(errors, /--require: unknown section "Nope"/);
    assert.match(checkPrBody(minimal.replace(/## Why\?[\s\S]*?(?=## Changelog)/, '')).errors.join('\n'), /missing section "## Why\?"/);
    assert.match(checkPrBody(`${minimal}\n## Dev Test\n\n`).errors.join('\n'), /"## Dev Test" .* is empty; fill it or remove the section/);
  });
  it('finds missing, duplicate, misordered and empty sections', () => {
    const body = example
      .replace(/## Dev Test\n\n[\s\S]*?\n(?=## )/, '## Dev Test\n\n<!-- later -->\n\n')
      .replace(/## Why\?[\s\S]*?(?=## Impact)/, '')
      .replace('## Impact', '## Validation\n\n- ran it\n\n## Impact');
    const errors = checkPrBody(body).errors.join('\n');
    assert.match(errors, /missing section "## Why\?"/);
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
      .concat('\n## Deployment notes\n\nNone.\n');
    const { errors, warnings } = checkPrBody(body);
    assert.deepEqual(errors, []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /"## Screenshots" sits among/);
  });
});

describe('What changed and Checklist', () => {
  it('requires a <details> block with content and a task list', () => {
    const open = example.replace(/<details>\n<summary>Changes by area<\/summary>\n/, '').replace('\n</details>\n', '\n');
    assert.match(checkPrBody(open).errors.join('\n'), /must put the detail in <details>/);
    const cramped = example.replace('</summary>\n\n', '</summary>\n');
    assert.deepEqual(checkPrBody(cramped).errors, []);
    assert.match(checkPrBody(cramped).warnings.join('\n'), /leave a blank line/);
    const noSummary = example.replace('<summary>Changes by area</summary>', '<summary> </summary>');
    assert.match(checkPrBody(noSummary).errors.join('\n'), /the <summary> is empty/);
    const prose = example.replace(/## Checklist\n\n[\s\S]*$/, '## Checklist\n\nAll good.\n');
    assert.match(checkPrBody(prose).errors.join('\n'), /needs task-list items/);
    assert.deepEqual(checkPrBody(example.replace('## Not included / follow-ups', '## Not included/follow-ups')).errors, []);
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

describe('checkTitle with a head branch', () => {
  it('requires the branch at the end and leaves it out of the length check', () => {
    const branch = 'feat/passkey-sign-in';
    assert.deepEqual(checkTitle(`feat(auth): add passkey sign-in [${branch}]`, { branch }), []);
    assert.match(checkTitle('feat(auth): add passkey sign-in', { branch })[0], /end with the head branch/);
    assert.deepEqual(checkTitle(`feat: ${'x'.repeat(60)} [${branch}]`, { branch }), []);
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
