#!/usr/bin/env node
// Summarizes one iteration of graded eval runs (see ../references/testing.md):
//   <iteration>/<eval-name>/<config>/grading.json            one run
//   <iteration>/<eval-name>/<config>/run-<n>/grading.json    or several runs
// with an optional timing.json beside each grading.json. <config> is with_skill, without_skill,
// old_skill or any other name; with_skill is listed first and compared with the next config.
//   node <skill-dir>/scripts/summarize-evals.mjs <iteration-dir> [--json]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const dirs = (path) =>
  readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined);

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const stddev = (values) => {
  if (values.length < 2) return null;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
};
const stats = (values) => ({ mean: mean(values), stddev: stddev(values), n: values.length });

/** One run: its expectations and timing, read from a folder holding grading.json. */
function readRun(path) {
  const grading = readJson(join(path, 'grading.json'));
  if (!grading) return undefined;
  if (!Array.isArray(grading.expectations))
    throw new Error(`${path}/grading.json: expectations must be a list of { text, passed, evidence }`);
  const timing = readJson(join(path, 'timing.json')) ?? {};
  const passed = grading.expectations.filter((e) => e.passed === true).length;
  const total = grading.expectations.length;
  return {
    expectations: grading.expectations.map((e) => ({ text: String(e.text), passed: e.passed === true })),
    passRate: total ? passed / total : null,
    tokens: Number.isFinite(timing.total_tokens) ? timing.total_tokens : null,
    seconds: Number.isFinite(timing.duration_ms)
      ? timing.duration_ms / 1000
      : Number.isFinite(timing.total_duration_seconds)
        ? timing.total_duration_seconds
        : null,
  };
}

const configOrder = (a, b) => (a === 'with_skill' ? -1 : b === 'with_skill' ? 1 : a.localeCompare(b));

export function summarize(iterationDir) {
  const runs = []; // { evalName, config, run }
  for (const evalName of dirs(iterationDir))
    for (const config of dirs(join(iterationDir, evalName))) {
      const base = join(iterationDir, evalName, config);
      const single = readRun(base);
      const found = single
        ? [single]
        : dirs(base)
            .filter((d) => /^run-/.test(d))
            .map((d) => readRun(join(base, d)))
            .filter(Boolean);
      for (const run of found) runs.push({ evalName, config, run });
    }
  if (!runs.length) throw new Error(`no grading.json files under ${iterationDir}`);

  const configs = [...new Set(runs.map((r) => r.config))].sort(configOrder);
  const evalNames = [...new Set(runs.map((r) => r.evalName))].sort();
  const pick = (key, filter) =>
    runs.filter(filter).map((r) => r.run[key]).filter((v) => v !== null);

  const byConfig = Object.fromEntries(
    configs.map((config) => [
      config,
      {
        passRate: stats(pick('passRate', (r) => r.config === config)),
        tokens: stats(pick('tokens', (r) => r.config === config)),
        seconds: stats(pick('seconds', (r) => r.config === config)),
      },
    ]),
  );
  const byEval = Object.fromEntries(
    evalNames.map((evalName) => [
      evalName,
      Object.fromEntries(
        configs.map((config) => [
          config,
          stats(pick('passRate', (r) => r.evalName === evalName && r.config === config)),
        ]),
      ),
    ]),
  );

  // Hints for the analyst: expectations that never tell configurations apart, and evals whose
  // repeated runs disagree.
  const notes = [];
  for (const evalName of evalNames) {
    const here = runs.filter((r) => r.evalName === evalName);
    const texts = [...new Set(here.flatMap((r) => r.run.expectations.map((e) => e.text)))];
    for (const text of texts) {
      const results = here.flatMap((r) => r.run.expectations.filter((e) => e.text === text).map((e) => e.passed));
      if (configs.length > 1 && new Set(here.map((r) => r.config)).size > 1 && results.every(Boolean))
        notes.push(`${evalName}: "${text}" passes in every configuration, so it does not show what the skill adds`);
      if (results.length > 1 && !results.some(Boolean))
        notes.push(`${evalName}: "${text}" fails in every run; check the expectation as well as the skill`);
    }
    for (const config of configs) {
      const s = byEval[evalName][config];
      if (s.n > 1 && s.stddev !== null && s.stddev >= 0.25)
        notes.push(`${evalName} (${config}): pass rate varies a lot between runs (stddev ${s.stddev.toFixed(2)}); the eval may be flaky`);
    }
  }

  const [first, second] = configs;
  const delta =
    second && byConfig[first].passRate.mean !== null && byConfig[second].passRate.mean !== null
      ? { from: second, to: first, passRate: byConfig[first].passRate.mean - byConfig[second].passRate.mean }
      : null;
  return { configs, evals: evalNames, byConfig, byEval, delta, notes };
}

const fmt = (s, digits = 2, scale = 1) =>
  s.mean === null
    ? '–'
    : `${(s.mean * scale).toFixed(digits)}${s.stddev === null ? '' : ` ± ${(s.stddev * scale).toFixed(digits)}`}`;

export function toMarkdown(summary) {
  const { configs, byConfig, byEval, delta, notes } = summary;
  const lines = [
    '| Configuration | Runs | Pass rate | Tokens | Seconds |',
    '| --- | --- | --- | --- | --- |',
    ...configs.map((c) => {
      const s = byConfig[c];
      return `| ${c} | ${s.passRate.n} | ${fmt(s.passRate, 0, 100)}% | ${fmt(s.tokens, 0)} | ${fmt(s.seconds, 1)} |`;
    }),
    '',
    `| Eval | ${configs.join(' | ')} |`,
    `| --- | ${configs.map(() => '---').join(' | ')} |`,
    ...Object.entries(byEval).map(
      ([name, row]) => `| ${name} | ${configs.map((c) => (row[c].n ? `${fmt(row[c], 0, 100)}%` : '–')).join(' | ')} |`,
    ),
  ];
  if (delta)
    lines.push('', `${delta.to} vs ${delta.from}: ${delta.passRate >= 0 ? '+' : ''}${(delta.passRate * 100).toFixed(0)} points pass rate.`);
  if (notes.length) lines.push('', 'Notes:', ...notes.map((n) => `- ${n}`));
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { json: { type: 'boolean', default: false } },
  });
  if (positionals.length !== 1) {
    console.error('Usage: node <skill-dir>/scripts/summarize-evals.mjs <iteration-dir> [--json]');
    process.exit(1);
  }
  try {
    const summary = summarize(positionals[0]);
    process.stdout.write(values.json ? `${JSON.stringify(summary, null, 2)}\n` : toMarkdown(summary));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
