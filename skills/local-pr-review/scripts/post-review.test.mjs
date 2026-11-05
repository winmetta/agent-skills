import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commentableLines, commentBody, findSecrets, fingerprint, markersIn, planReview, reviewBody, validateFindings } from './post-review.mjs';

const patch = [
  '@@ -1,3 +1,4 @@',
  ' a',
  '-b',
  '+B',
  '+C',
  ' d',
  '@@ -20,2 +21,2 @@ function x() {',
  ' keep',
  '-old',
  '+new',
  '\\ No newline at end of file',
].join('\n');

const finding = (over = {}) => ({
  severity: 'high',
  title: 'Retries never stop',
  body: 'Explain.',
  path: 'src/a.js',
  line: 2,
  start_line: null,
  side: 'RIGHT',
  suggestion: null,
  repo: null,
  ...over,
});

test('commentableLines maps head and base lines to their hunks', () => {
  const { RIGHT, LEFT } = commentableLines(patch);
  assert.deepEqual([...RIGHT.keys()], [1, 2, 3, 4, 21, 22]);
  assert.deepEqual([...LEFT.keys()], [1, 2, 3, 20, 21]);
  assert.equal(RIGHT.get(4), 0);
  assert.equal(RIGHT.get(22), 1);
  assert.equal(commentableLines(undefined).RIGHT.size, 0);
});

test('fingerprint ignores the line and case of the title', () => {
  assert.equal(fingerprint(finding()), fingerprint(finding({ line: 40, title: ' retries never STOP ' })));
  assert.notEqual(fingerprint(finding()), fingerprint(finding({ path: 'src/b.js' })));
  assert.deepEqual(markersIn(commentBody(finding(), { inline: true })), [fingerprint(finding())]);
});

test('planReview puts in-diff findings inline and the rest in the summary', () => {
  const files = [{ filename: 'src/a.js', patch }];
  const findings = [
    finding(),
    finding({ title: 'Range', line: 3, start_line: 1 }),
    finding({ title: 'Cross-hunk range', line: 21, start_line: 3 }),
    finding({ title: 'Outside diff', line: 10 }),
    finding({ title: 'Other file', path: 'src/z.js' }),
    finding({ title: 'Other repo', repo: 'o/other' }),
    finding({ title: 'Already posted' }),
  ];
  const plan = planReview({ findings, files, repo: 'o/r', posted: new Set([fingerprint(findings[6])]) });
  assert.deepEqual(plan.inline.map((i) => i.finding.title), ['Retries never stop', 'Range', 'Cross-hunk range']);
  assert.equal(plan.inline[1].comment.start_line, 1);
  assert.equal(plan.inline[2].comment.start_line, undefined, 'a range across hunks falls back to one line');
  assert.deepEqual(plan.summary.map((f) => f.reason), ['line outside the diff', 'file not in this PR', 'other repository']);
  assert.equal(plan.skipped.length, 1);
});

test('suggestions are applied inline only, with a fence longer than any backticks inside', () => {
  const f = finding({ suggestion: 'const s = `x`;\n' });
  assert.match(commentBody(f, { inline: true }), /\n```suggestion\nconst s = `x`;\n```\n/);
  assert.match(commentBody(f, { inline: false }), /\n```\nconst s/);
  assert.match(commentBody(finding({ suggestion: 'a ``` b' }), { inline: true }), /````suggestion/);
});

test('reviewBody records the head commit and counts', () => {
  const plan = planReview({ findings: [finding(), finding({ title: 'x', severity: 'low', line: 99 })], files: [{ filename: 'src/a.js', patch }], repo: 'o/r' });
  const body = reviewBody({ plan, summary: 'Looks fine.', headSha: 'abcdef1234567890', reviewer: 'codex' });
  assert.match(body, /Automated review \(codex\)/);
  assert.match(body, /New findings: 1 high, 1 low\./);
  assert.match(body, /<!-- local-pr-review:head=abcdef1234567890 -->/);
  assert.match(body, /src\/a\.js:99/);
  assert.match(body, /<!-- local-pr-review:new=2 -->/);
  const empty = reviewBody({ plan: { inline: [], summary: [], skipped: [] }, summary: '', headSha: 'abc' });
  assert.match(empty, /No new findings\./);
  assert.match(empty, /<!-- local-pr-review:new=0 -->/);
  assert.doesNotMatch(empty, /resolve its thread/);
});

test('validateFindings reports bad entries', () => {
  assert.deepEqual(validateFindings({ summary: '', findings: [finding()] }), []);
  const errors = validateFindings({ findings: [{ severity: 'urgent', line: 0 }] });
  assert.equal(errors.length, 4);
  const range = validateFindings({ findings: [finding({ start_line: '3' }), finding({ start_line: 0 }), finding({ side: 'BOTH' })] });
  assert.deepEqual(range, [
    'findings[0].start_line must be a positive integer or null.',
    'findings[1].start_line must be a positive integer or null.',
    'findings[2].side must be LEFT or RIGHT.',
  ]);
  assert.deepEqual(validateFindings({ findings: [null, 'x', finding({ repo: 'ghp_x y' }), finding({ repo: 'o/other' })] }), [
    'findings[0] must be an object.',
    'findings[1] must be an object.',
    'findings[2].repo must be owner/name or null.',
  ]);
  assert.deepEqual(validateFindings(null), ['The findings file must contain a JSON object.']);
});

test('a suggestion whose range cannot be kept moves to the summary', () => {
  const files = [{ filename: 'src/a.js', patch }];
  const plan = planReview({
    findings: [
      finding({ title: 'Cross-hunk suggestion', line: 21, start_line: 3, suggestion: 'a\nb' }),
      finding({ title: 'Start outside diff', line: 3, start_line: 99, suggestion: 'a\nb' }),
      finding({ title: 'Start after end', line: 2, start_line: 3, suggestion: 'a' }),
      finding({ title: 'One-line range', line: 2, start_line: 2, suggestion: 'a' }),
      finding({ title: 'Valid range', line: 3, start_line: 1, suggestion: 'a\nb\nc' }),
    ],
    files,
    repo: 'o/r',
  });
  assert.deepEqual(plan.inline.map((i) => i.finding.title), ['One-line range', 'Valid range']);
  assert.equal(plan.inline[0].comment.start_line, undefined);
  assert.equal(plan.inline[1].comment.start_line, 1);
  assert.equal(plan.summary.length, 3);
});

test('findSecrets flags private keys and token-shaped strings', () => {
  assert.deepEqual(findSecrets({ summary: 'ok', findings: [finding()] }), []);
  const key = ['-----BEGIN RSA', 'PRIVATE KEY-----'].join(' ');
  const hits = findSecrets({ summary: key, findings: [finding({ body: `token ghp_${'a'.repeat(30)}` })] });
  assert.deepEqual(hits, ['summary', 'findings[0].body']);
  assert.deepEqual(findSecrets({ findings: [finding({ repo: `ghp_${'b'.repeat(30)}` })] }), ['findings[0].repo']);
});
