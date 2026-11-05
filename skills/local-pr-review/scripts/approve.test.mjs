import assert from 'node:assert/strict';
import { test } from 'node:test';
import { approvalState, describe, newCountMarker } from './approve.mjs';
import { graphqlUrl } from './github.mjs';

const BOT = 'demo-reviewer[bot]';
const HEAD = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const review = (sha, found, login = BOT) => ({
  user: { login },
  body: `### Automated review\n\n<!-- local-pr-review:head=${sha} -->${found === undefined ? '' : `\n${newCountMarker(found)}`}`,
});

test('approves when the latest bot review is for the head, found nothing and no thread is open', () => {
  const s = approvalState({ reviews: [review(OLD, 2), review(HEAD, 0)], login: BOT, headSha: HEAD, unresolved: 0 });
  assert.equal(s.approve, true);
});

test('does not approve without a bot review, or with one for an older commit', () => {
  assert.match(approvalState({ reviews: [review(HEAD, 0, 'someone')], login: BOT, headSha: HEAD, unresolved: 0 }).reason, /not reviewed/);
  assert.match(approvalState({ reviews: [review(OLD, 0)], login: BOT, headSha: HEAD, unresolved: 0 }).reason, /not the head/);
});

test('does not approve with new findings, unresolved threads or an old review without a count', () => {
  assert.match(approvalState({ reviews: [review(HEAD, 1)], login: BOT, headSha: HEAD, unresolved: 0 }).reason, /1 new finding/);
  assert.match(approvalState({ reviews: [review(HEAD, 0)], login: BOT, headSha: HEAD, unresolved: 2 }).reason, /2 review thread/);
  assert.match(approvalState({ reviews: [review(HEAD, undefined)], login: BOT, headSha: HEAD, unresolved: 0 }).reason, /finding count/);
});

test('describe says what changed', () => {
  assert.match(describe({ approve: true, reason: 'ok', action: 'added' }), /^Added the bot's 👍: ok\.$/);
  assert.match(describe({ approve: false, reason: 'no', action: 'removed' }, { dryRun: true }), /^\(dry run\) Would have: removed/);
});

test('graphqlUrl handles github.com and GitHub Enterprise Server', () => {
  assert.equal(graphqlUrl('https://api.github.com'), 'https://api.github.com/graphql');
  assert.equal(graphqlUrl('https://ghe.example/api/v3'), 'https://ghe.example/api/graphql');
});
