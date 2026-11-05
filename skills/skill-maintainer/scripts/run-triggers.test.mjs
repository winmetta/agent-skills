import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDetector, isHeldOut, neighbourDirs, score, skillFileFor, toText } from './run-triggers.mjs';
import { readSkillFile } from './skill-rules.mjs';

const line = (event) => JSON.stringify(event);
const init = (skills) => line({ type: 'system', subtype: 'init', skills });
const toolUse = (name, input) => line({ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', name, input }] } });

test('the detector reports the skill a Skill tool call loads', () => {
  const d = createDetector('demo-trigger-abc');
  assert.deepEqual(d.feed(init(['other', 'demo-trigger-abc'])), { done: false });
  assert.equal(d.registered, true);
  assert.deepEqual(d.feed(toolUse('Skill', { skill: 'demo-trigger-abc' })), { done: true, chosen: 'demo-trigger-abc' });
  assert.deepEqual(createDetector('x').feed(toolUse('Skill', { skill: 'plugin:other' })), { done: true, chosen: 'plugin:other' });
});

test('the detector counts reading the skill file, and treats other first tools or no tools as no skill', () => {
  assert.deepEqual(createDetector('demo-t').feed(toolUse('Read', { file_path: '/p/.claude/skills/demo-t/SKILL.md' })), { done: true, chosen: 'demo-t' });
  assert.deepEqual(createDetector('demo-t').feed(toolUse('Bash', { command: 'ls' })), { done: true, chosen: '' });
  assert.deepEqual(createDetector('demo-t').feed(line({ type: 'result', subtype: 'success' })), { done: true, chosen: '' });
  assert.deepEqual(createDetector('demo-t').feed('not json'), { done: false });
  const d = createDetector('demo-t');
  d.feed(init(['other']));
  assert.equal(d.registered, false);
});

test('the held-out split is stable and roughly the requested size', () => {
  const queries = Array.from({ length: 300 }, (_, i) => `query number ${i}`);
  const held = queries.filter((q) => isHeldOut(q, 0.33));
  assert.ok(held.length > 60 && held.length < 140, `${held.length} held out`);
  assert.deepEqual(held, queries.filter((q) => isHeldOut(q, 0.33)));
  assert.equal(queries.some((q) => isHeldOut(q, 0)), false);
});

test('score counts correct answers, precision and recall', () => {
  const s = score([
    { should_trigger: true, rate: 1 },
    { should_trigger: true, rate: 0.33 },
    { should_trigger: false, rate: 0.67 },
    { should_trigger: false, rate: 0 },
  ]);
  assert.deepEqual(
    { passed: s.passed, total: s.total, precision: s.precision, recall: s.recall },
    { passed: 2, total: 4, precision: 0.5, recall: 0.5 },
  );
  assert.equal(score([]).precision, null);
});

test('the copied SKILL.md keeps the body and quotes the candidate description', () => {
  const text = skillFileFor('demo-trigger-1', 'Does "x": y. Use when z.', '\n# Demo\n\nBody.\n');
  const parsed = readSkillFile(text);
  assert.equal(parsed.data.name, 'demo-trigger-1');
  assert.equal(parsed.data.description, 'Does "x": y. Use when z.');
  assert.equal(parsed.body, '\n# Demo\n\nBody.\n');
});

test('the text report marks failures, held-out queries and competing skills', () => {
  const results = [
    { query: 'review my PR', should_trigger: true, heldOut: false, triggers: 1, runs: 3, rate: 1 / 3, others: { 'code-review': 2 }, errors: 0 },
    { query: 'write a poem', should_trigger: false, heldOut: true, triggers: 0, runs: 3, rate: 0, others: {}, errors: 0 },
  ];
  const text = toText({ description: 'D', threshold: 0.5, tuning: score([results[0]]), heldOut: score([results[1]]), results });
  assert.match(text, /\[FAIL\] 1\/3 want=yes other: code-review×2 {2}review my PR/);
  assert.match(text, /\[PASS\] 0\/3 want=no  \(held out\) {2}write a poem/);
  assert.match(text, /Held out: 1\/1 correct/);
});

test('neighbourDirs prefers --neighbours, skips the tested skill and folders without SKILL.md', () => {
  const root = mkdtempSync(join(tmpdir(), 'neighbours-'));
  const make = (folder, name, withSkill = true) => {
    mkdirSync(join(root, folder, name), { recursive: true });
    if (withSkill) writeFileSync(join(root, folder, name, 'SKILL.md'), '---\nname: x\ndescription: y\n---\n');
  };
  make('catalog', 'tested');
  make('catalog', 'shared');
  make('user', 'shared');
  make('user', 'only-user');
  make('user', 'empty', false);
  const picked = neighbourDirs([join(root, 'catalog'), join(root, 'user'), join(root, 'missing')], 'tested');
  assert.deepEqual([...picked.keys()].sort(), ['only-user', 'shared']);
  assert.equal(picked.get('shared'), join(root, 'catalog', 'shared'));
  rmSync(root, { recursive: true, force: true });
});
