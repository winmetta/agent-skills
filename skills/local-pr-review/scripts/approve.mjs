#!/usr/bin/env node
// Marks a pull request as approved by the review bot with a 👍 reaction on its description, or takes the
// 👍 away. The 👍 is a signal, not a GitHub approval: it never counts toward required approving reviews.
// The bot approves only when all of these hold:
//   - its latest review is for the PR's current head commit;
//   - that review found no new findings;
//   - no review thread on the PR is unresolved (the bot's or anyone else's).
// Otherwise it removes a 👍 it left earlier, so a stale approval never outlives a new push or finding.
// post-review.mjs runs this after every post; run it yourself after resolving the last thread.
// Usage: approve.mjs --pr owner/repo#123 [--dry-run]
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { appInstallationAuth, graphql, hasAppConfig, loadConfig, paginate, parsePr, request } from './github.mjs';

const MARK = 'local-pr-review';
export const newCountMarker = (n) => `<!-- ${MARK}:new=${n} -->`;
const headOf = (body) => String(body ?? '').match(new RegExp(`<!-- ${MARK}:head=([0-9a-f]+) -->`))?.[1];
const newOf = (body) => {
  const m = String(body ?? '').match(new RegExp(`<!-- ${MARK}:new=(\\d+) -->`));
  return m ? Number(m[1]) : undefined;
};

/**
 * Decides whether the bot should approve. reviews: the PR's reviews in order; login: the bot's login;
 * unresolved: the number of unresolved review threads. Returns { approve, reason }.
 */
export const approvalState = ({ reviews, login, headSha, unresolved }) => {
  const latest = reviews.filter((r) => r.user?.login === login && headOf(r.body)).at(-1);
  if (!latest) return { approve: false, reason: 'the bot has not reviewed this PR' };
  const reviewed = headOf(latest.body);
  if (reviewed !== headSha) return { approve: false, reason: `the latest review is for ${reviewed.slice(0, 12)}, not the head ${headSha.slice(0, 12)}` };
  const found = newOf(latest.body);
  if (found === undefined) return { approve: false, reason: 'the latest review does not record its finding count; run the review again' };
  if (found > 0) return { approve: false, reason: `the latest review has ${found} new finding(s)` };
  if (unresolved > 0) return { approve: false, reason: `${unresolved} review thread(s) are unresolved` };
  return { approve: true, reason: 'the latest review is for the head commit, found nothing new, and every thread is resolved' };
};

const THREADS = `query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $after) { nodes { isResolved } pageInfo { hasNextPage endCursor } }
    }
  }
}`;

export const countUnresolved = async ({ repo, number, token }) => {
  const [owner, name] = repo.split('/');
  let after = null;
  let count = 0;
  for (let page = 0; page < 30; page++) {
    const data = await graphql(THREADS, { owner, name, number, after }, { token });
    const threads = data.repository.pullRequest.reviewThreads;
    count += threads.nodes.filter((t) => !t.isResolved).length;
    if (!threads.pageInfo.hasNextPage) break;
    after = threads.pageInfo.endCursor;
  }
  return count;
};

/** Adds or removes the bot's 👍 on the PR to match approvalState. Returns the state and what changed. */
export const syncApproval = async ({ repo, number, auth, dryRun = false }) => {
  const opts = { token: auth.token };
  const pr = await request('GET', `/repos/${repo}/pulls/${number}`, opts);
  if (pr.state !== 'open') return { approve: false, approved: false, action: 'none', reason: `the PR is ${pr.merged ? 'merged' : 'closed'}, so its 👍 is left as it is` };
  const reviews = await paginate(`/repos/${repo}/pulls/${number}/reviews`, opts);
  const unresolved = await countUnresolved({ repo, number, token: auth.token });
  const state = approvalState({ reviews, login: auth.login, headSha: pr.head.sha, unresolved });
  const reactions = await paginate(`/repos/${repo}/issues/${number}/reactions?content=%2B1`, opts);
  const mine = reactions.filter((r) => r.user?.login === auth.login);
  let action = 'none';
  if (state.approve && !mine.length) {
    action = 'added';
    if (!dryRun) await request('POST', `/repos/${repo}/issues/${number}/reactions`, { ...opts, body: { content: '+1' } });
  } else if (!state.approve && mine.length) {
    action = 'removed';
    if (!dryRun) for (const r of mine) await request('DELETE', `/repos/${repo}/issues/${number}/reactions/${r.id}`, opts);
  }
  return { ...state, action, approved: state.approve };
};

export const describe = ({ approve, reason, action }, { dryRun = false } = {}) => {
  const verb = { added: "Added the bot's 👍", removed: "Removed the bot's earlier 👍", none: approve ? "The bot's 👍 is already there" : 'No change' }[action];
  return `${dryRun && action !== 'none' ? `(dry run) Would have: ${verb.toLowerCase()}` : verb}: ${reason}.`;
};

export const main = async (argv) => {
  const { values } = parseArgs({ args: argv, options: { pr: { type: 'string' }, 'dry-run': { type: 'boolean', default: false } } });
  if (!values.pr) {
    console.error('Usage: approve.mjs --pr owner/repo#123 [--dry-run]');
    return 2;
  }
  const { repo, number } = parsePr(values.pr);
  const config = loadConfig();
  if (!hasAppConfig(config)) {
    console.error('No GitHub App configured (LOCAL_PR_REVIEW_APP_ID, LOCAL_PR_REVIEW_APP_KEY). See references/github-app-setup.md.');
    return 1;
  }
  const auth = await appInstallationAuth(repo, config);
  const result = await syncApproval({ repo, number, auth, dryRun: values['dry-run'] });
  console.log(describe(result, { dryRun: values['dry-run'] }));
  return 0;
};

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.message);
      process.exit(1);
    },
  );
}
