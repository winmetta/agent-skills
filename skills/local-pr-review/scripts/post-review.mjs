#!/usr/bin/env node
// Posts review findings on a GitHub pull request as one review from a GitHub App bot.
// Findings on lines inside the PR's diff become inline threads, which the author must resolve; the rest
// (lines outside the diff, files not in the PR, other repositories) go into the review's summary.
// Findings the bot already posted on this PR (matched by a hidden fingerprint) are not posted again.
// After posting it runs approve.mjs, which adds the bot's 👍 to the PR when nothing is left to fix.
// Usage: post-review.mjs --pr owner/repo#123 --findings findings.json [--reviewer claude] [--head <sha>] [--dry-run]
//   --findings  JSON matching assets/findings.schema.json; "-" reads standard input
//   --head      the commit that was reviewed; posting is refused if the PR head has moved since
//   --reviewer  engine name shown in the summary (e.g. claude, codex)
//   --dry-run   print what would be posted and post nothing (works with the gh CLI login if no App is set up)
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { describe as describeApproval, newCountMarker, syncApproval } from './approve.mjs';
import { appInstallationAuth, ghCliToken, hasAppConfig, loadConfig, paginate, parsePr, request } from './github.mjs';

export const SEVERITIES = ['high', 'medium', 'low'];
const MARK = 'local-pr-review';

// Lines a review comment can attach to, per side, with the hunk each belongs to
// (a multi-line comment must start and end in the same hunk).
export const commentableLines = (patch) => {
  const right = new Map();
  const left = new Map();
  if (!patch) return { RIGHT: right, LEFT: left };
  let oldLine = 0;
  let newLine = 0;
  let hunk = -1;
  for (const line of patch.split('\n')) {
    const h = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) {
      oldLine = Number(h[1]);
      newLine = Number(h[2]);
      hunk++;
    } else if (hunk < 0 || line.startsWith('\\')) {
      continue;
    } else if (line.startsWith('+')) {
      right.set(newLine++, hunk);
    } else if (line.startsWith('-')) {
      left.set(oldLine++, hunk);
    } else {
      right.set(newLine++, hunk);
      left.set(oldLine++, hunk);
    }
  }
  return { RIGHT: right, LEFT: left };
};

// Stable across pushes that move code around: the path and the title, not the line.
export const fingerprint = (f) =>
  createHash('sha1')
    .update(`${f.repo ?? ''}\n${f.path ?? ''}\n${String(f.title).trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 12);

export const markerFor = (fp) => `<!-- ${MARK}:fp=${fp} -->`;
export const headMarker = (sha) => `<!-- ${MARK}:head=${sha} -->`;
export const markersIn = (text) => [...String(text ?? '').matchAll(new RegExp(`<!-- ${MARK}:fp=([0-9a-f]+) -->`, 'g'))].map((m) => m[1]);

// Text that looks like a credential. The reviewer reads an untrusted checkout, so a prompt-injected model
// could copy a key it can read into a finding, and posting would publish it. Refuse instead of posting.
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
];

export const findSecrets = (doc) => {
  const hits = [];
  const check = (label, text) => {
    if (typeof text === 'string' && SECRET_PATTERNS.some((re) => re.test(text))) hits.push(label);
  };
  check('summary', doc?.summary);
  for (const [i, f] of (doc?.findings ?? []).entries()) {
    for (const key of ['title', 'body', 'suggestion', 'path', 'repo']) check(`findings[${i}].${key}`, f?.[key]);
  }
  return hits;
};

export const validateFindings = (doc) => {
  const errors = [];
  if (!doc || typeof doc !== 'object') return ['The findings file must contain a JSON object.'];
  if (!Array.isArray(doc.findings)) errors.push('"findings" must be an array.');
  for (const [i, f] of (doc.findings ?? []).entries()) {
    const at = `findings[${i}]`;
    if (!f || typeof f !== 'object' || Array.isArray(f)) {
      errors.push(`${at} must be an object.`);
      continue;
    }
    if (!f.title || typeof f.title !== 'string') errors.push(`${at}.title is required.`);
    if (!f.body || typeof f.body !== 'string') errors.push(`${at}.body is required.`);
    if (!SEVERITIES.includes(f.severity)) errors.push(`${at}.severity must be one of ${SEVERITIES.join(', ')}.`);
    if (f.line != null && (!Number.isInteger(f.line) || f.line < 1)) errors.push(`${at}.line must be a positive integer or null.`);
    if (f.start_line != null && (!Number.isInteger(f.start_line) || f.start_line < 1)) {
      errors.push(`${at}.start_line must be a positive integer or null.`);
    }
    if (f.side != null && f.side !== 'LEFT' && f.side !== 'RIGHT') errors.push(`${at}.side must be LEFT or RIGHT.`);
    if (f.repo != null && (typeof f.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(f.repo))) errors.push(`${at}.repo must be owner/name or null.`);
  }
  return errors;
};

const fence = (text) => {
  const longest = Math.max(2, ...[...String(text).matchAll(/`+/g)].map((m) => m[0].length));
  return '`'.repeat(longest + 1);
};

export const commentBody = (f, { inline }) => {
  const parts = [`**[${f.severity}] ${f.title.trim()}**`, '', f.body.trim()];
  if (f.suggestion != null && f.suggestion !== '') {
    const ticks = fence(f.suggestion);
    // A suggestion block only works inline, where GitHub can apply it to the commented lines.
    parts.push('', `${ticks}${inline ? 'suggestion' : ''}`, f.suggestion.replace(/\n$/, ''), ticks);
  }
  parts.push('', markerFor(fingerprint(f)));
  return parts.join('\n');
};

const where = (f) => [f.repo, f.path].filter(Boolean).join(':') + (f.line ? `:${f.line}` : '');

// Splits findings into inline review comments and summary items, dropping ones already posted.
export const planReview = ({ findings, files, repo, posted = new Set() }) => {
  const byPath = new Map(files.map((file) => [file.filename, commentableLines(file.patch)]));
  const plan = { inline: [], summary: [], skipped: [] };
  for (const f of findings) {
    if (posted.has(fingerprint(f))) {
      plan.skipped.push(f);
      continue;
    }
    const sameRepo = !f.repo || f.repo.toLowerCase() === repo.toLowerCase();
    const side = f.side === 'LEFT' ? 'LEFT' : 'RIGHT';
    const lines = sameRepo && f.path ? byPath.get(f.path)?.[side] : undefined;
    if (!lines || !f.line || !lines.has(f.line)) {
      plan.summary.push({ ...f, reason: !sameRepo ? 'other repository' : !lines ? 'file not in this PR' : 'line outside the diff' });
      continue;
    }
    const comment = { path: f.path, line: f.line, side, body: commentBody(f, { inline: true }) };
    const start = f.start_line;
    const hasRange = start != null && start !== f.line;
    const rangeOk = Number.isInteger(start) && start < f.line && lines.has(start) && lines.get(start) === lines.get(f.line);
    if (hasRange && !rangeOk && f.suggestion) {
      // GitHub would apply a multi-line suggestion to the single line, duplicating or corrupting code.
      plan.summary.push({ ...f, reason: 'suggested range is not inside one diff hunk' });
      continue;
    }
    if (hasRange && rangeOk) {
      comment.start_line = start;
      comment.start_side = side;
    }
    plan.inline.push({ finding: f, comment });
  }
  return plan;
};

export const reviewBody = ({ plan, summary, headSha, reviewer, inlineFallback = false }) => {
  const counts = SEVERITIES.map((s) => [s, [...plan.inline.map((i) => i.finding), ...plan.summary].filter((f) => f.severity === s).length])
    .filter(([, n]) => n)
    .map(([s, n]) => `${n} ${s}`);
  const lines = [
    `### Automated review${reviewer ? ` (${reviewer})` : ''}`,
    '',
    `Reviewed commit \`${headSha.slice(0, 12)}\`. ${counts.length ? `New findings: ${counts.join(', ')}.` : 'No new findings.'}`,
  ];
  if (plan.skipped.length) lines.push(`${plan.skipped.length} finding(s) from an earlier review are not repeated.`);
  if (summary?.trim()) lines.push('', summary.trim());
  if (plan.summary.length) {
    lines.push('', inlineFallback ? '#### Findings' : '#### Findings outside the diff');
    for (const f of plan.summary) {
      lines.push('', `- \`${where(f) || 'general'}\``, '', commentBody(f, { inline: false }).replace(/^(?=.)/gm, '  '));
    }
  }
  if (plan.inline.length || plan.summary.length) {
    lines.push('', 'Fix each finding and resolve its thread, or reply to explain why it does not apply.');
  }
  lines.push('', headMarker(headSha), newCountMarker(plan.inline.length + plan.summary.length));
  return lines.join('\n');
};

const printPlan = (plan, body) => {
  console.log(`Inline threads: ${plan.inline.length}, in summary: ${plan.summary.length}, already posted: ${plan.skipped.length}\n`);
  for (const { comment } of plan.inline) {
    const range = comment.start_line ? `${comment.start_line}-${comment.line}` : comment.line;
    console.log(`--- ${comment.path}:${range} (${comment.side})\n${comment.body}\n`);
  }
  console.log(`--- review summary\n${body}`);
};

export const main = async (argv) => {
  const { values } = parseArgs({
    args: argv,
    options: {
      pr: { type: 'string' },
      findings: { type: 'string' },
      reviewer: { type: 'string' },
      head: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (!values.pr || !values.findings) {
    console.error('Usage: post-review.mjs --pr owner/repo#123 --findings findings.json [--reviewer name] [--head sha] [--dry-run]');
    return 2;
  }
  const { repo, number } = parsePr(values.pr);
  const doc = JSON.parse(readFileSync(values.findings === '-' ? 0 : values.findings, 'utf8'));
  const errors = validateFindings(doc);
  if (errors.length) {
    for (const e of errors) console.error(e);
    return 1;
  }

  const secrets = findSecrets(doc);
  if (secrets.length) {
    console.error(`Refusing to post: ${secrets.join(', ')} look like a credential or private key. Remove it from the findings file.`);
    return 1;
  }

  const dryRun = values['dry-run'];
  const config = loadConfig();
  let auth;
  if (hasAppConfig(config)) auth = await appInstallationAuth(repo, config);
  else if (dryRun) auth = { token: ghCliToken(), login: '' };
  else {
    console.error('No GitHub App configured (LOCAL_PR_REVIEW_APP_ID, LOCAL_PR_REVIEW_APP_KEY). See references/github-app-setup.md.');
    return 1;
  }
  const opts = { token: auth.token };

  const pr = await request('GET', `/repos/${repo}/pulls/${number}`, opts);
  const files = await paginate(`/repos/${repo}/pulls/${number}/files`, opts);
  const posted = new Set();
  if (auth.login) {
    const mine = (items) => items.filter((c) => c.user?.login === auth.login);
    for (const c of mine(await paginate(`/repos/${repo}/pulls/${number}/comments`, opts))) markersIn(c.body).forEach((fp) => posted.add(fp));
    for (const r of mine(await paginate(`/repos/${repo}/pulls/${number}/reviews`, opts))) markersIn(r.body).forEach((fp) => posted.add(fp));
  }

  const plan = planReview({ findings: doc.findings, files, repo, posted });
  const headSha = pr.head.sha;
  if (values.head && !headSha.startsWith(values.head) && !values.head.startsWith(headSha)) {
    // Line numbers and the "reviewed commit" note belong to the reviewed commit, not to the new head.
    const msg = `The PR head moved to ${headSha.slice(0, 12)} after the review of ${values.head.slice(0, 12)}. Run the review again.`;
    if (!dryRun) {
      console.error(msg);
      return 1;
    }
    console.error(`Warning: ${msg}`);
  }
  const body = reviewBody({ plan, summary: doc.summary, headSha, reviewer: values.reviewer });
  if (dryRun) {
    printPlan(plan, body);
    if (!auth.login) console.log('\n(Dry run with the gh CLI login: earlier bot findings were not checked for duplicates.)');
    return 0;
  }

  const post = (b, comments) =>
    request('POST', `/repos/${repo}/pulls/${number}/reviews`, { ...opts, body: { commit_id: headSha, event: 'COMMENT', body: b, comments } });
  let review;
  try {
    review = await post(body, plan.inline.map((i) => i.comment));
  } catch (err) {
    if (err.status !== 422 || !plan.inline.length) throw err;
    // GitHub rejected a line position; keep every finding by moving them all into the summary.
    console.error(`Inline comments rejected (${err.message}); posting all findings in the summary instead.`);
    const fallback = { ...plan, summary: [...plan.inline.map((i) => ({ ...i.finding })), ...plan.summary], inline: [] };
    review = await post(reviewBody({ plan: fallback, summary: doc.summary, headSha, reviewer: values.reviewer, inlineFallback: true }), []);
  }
  console.log(`Posted review as ${auth.login}: ${review.html_url}`);
  // Approve (👍 on the PR description) when nothing is left to fix, or withdraw an earlier 👍.
  try {
    console.log(describeApproval(await syncApproval({ repo, number, auth })));
  } catch (err) {
    console.error(`The review was posted, but updating the bot's 👍 failed: ${err.message}. Run approve.mjs --pr ${repo}#${number}.`);
  }
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
