#!/usr/bin/env node
// Runs a skill's trigger tests (triggers.json, see ../references/testing.md section 5) against the real
// Claude Code CLI and reports how often each query loads the skill.
//   node <skill-dir>/scripts/run-triggers.mjs <skill-folder> --triggers <triggers.json>
//        [--description "<candidate>"] [--model <model>] [--runs 3] [--workers 4] [--timeout 90]
//        [--holdout 0.33] [--neighbours <skills-folder>] [--json]
// Each run is a fresh `claude -p` in a throwaway project holding a copy of the skill (with the candidate
// description) and links to the skills it competes with: your user-level skills from ~/.claude/skills,
// as in real use, plus any --neighbours folder. User settings are not loaded (--setting-sources
// project,local), so an installed copy of the same skill can't answer in its place; the model therefore
// comes from --model, or else the "model" in ~/.claude/settings.json. The run stops at the model's first
// tool call, so each query costs one short turn. Nothing is written to the repository.
// Needs Node 20+ and a logged-in `claude`.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { readSkillFile } from './skill-rules.mjs';
import { quoteYaml } from './yaml-subset.mjs';

/**
 * Reads `claude -p --output-format stream-json` lines and decides what the first tool call did.
 * Returns { done, chosen } where chosen is the skill name loaded, '' for no skill, or undefined
 * while undecided. Skills from a plugin are named "<plugin>:<skill>".
 */
export function createDetector(testName) {
  let registered;
  return {
    get registered() {
      return registered;
    },
    feed(line) {
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        return { done: false };
      }
      if (event.type === 'system' && event.subtype === 'init') {
        registered = (event.skills ?? []).map(String).some((s) => s === testName || s.endsWith(`:${testName}`));
        return { done: false };
      }
      if (event.type === 'assistant') {
        for (const item of event.message?.content ?? []) {
          if (item.type !== 'tool_use') continue;
          if (item.name === 'Skill') return { done: true, chosen: String(item.input?.skill ?? '') };
          if (item.name === 'Read' && String(item.input?.file_path ?? '').includes(`/${testName}/`)) {
            return { done: true, chosen: testName };
          }
          return { done: true, chosen: '' };
        }
      }
      if (event.type === 'result') return { done: true, chosen: '' };
      return { done: false };
    },
  };
}

/** A stable split, so the same queries stay held out between runs. */
export const isHeldOut = (query, fraction) =>
  fraction > 0 && createHash('sha1').update(query).digest().readUInt32BE(0) / 0xffffffff < fraction;

export function score(results, threshold = 0.5) {
  const out = { total: results.length, passed: 0, truePositive: 0, falsePositive: 0, falseNegative: 0 };
  for (const r of results) {
    const fired = r.rate >= threshold;
    if (fired === r.should_trigger) out.passed++;
    if (fired && r.should_trigger) out.truePositive++;
    if (fired && !r.should_trigger) out.falsePositive++;
    if (!fired && r.should_trigger) out.falseNegative++;
  }
  const ratio = (a, b) => (b ? a / b : null);
  out.precision = ratio(out.truePositive, out.truePositive + out.falsePositive);
  out.recall = ratio(out.truePositive, out.truePositive + out.falseNegative);
  return out;
}

export const skillFileFor = (name, description, body) =>
  `---\nname: ${name}\ndescription: ${quoteYaml(description)}\n---\n${body}`;

/** Skill folders to link in as competitors: --neighbours first, then the user's, never the one tested. */
export function neighbourDirs(folders, exclude) {
  const picked = new Map();
  for (const folder of folders) {
    if (!folder || !existsSync(folder)) continue;
    for (const entry of readdirSync(folder)) {
      const dir = resolve(folder, entry);
      if (entry === exclude || picked.has(entry) || !existsSync(join(dir, 'SKILL.md'))) continue;
      picked.set(entry, dir);
    }
  }
  return picked;
}

function makeProject({ skillDir, name, description, neighbours }) {
  const project = mkdtempSync(join(tmpdir(), 'skill-triggers-'));
  const skills = join(project, '.claude', 'skills');
  mkdirSync(join(skills, name), { recursive: true });
  const { body } = readSkillFile(readFileSync(join(skillDir, 'SKILL.md'), 'utf8'));
  writeFileSync(join(skills, name, 'SKILL.md'), skillFileFor(name, description, body));
  const links = neighbourDirs([neighbours, join(homedir(), '.claude', 'skills')], name);
  for (const [entry, dir] of links) symlinkSync(dir, join(skills, entry));
  return { project, neighbourCount: links.size };
}

const userModel = () => {
  try {
    return JSON.parse(readFileSync(join(homedir(), '.claude', 'settings.json'), 'utf8')).model || undefined;
  } catch {
    return undefined;
  }
};

function runOnce({ query, project, testName, model, timeoutMs }) {
  return new Promise((done) => {
    const args = ['-p', query, '--output-format', 'stream-json', '--verbose', '--max-turns', '1', '--setting-sources', 'project,local'];
    if (model) args.push('--model', model);
    // CLAUDECODE is set inside a Claude Code session to stop nested runs; a child `claude -p` is fine.
    const env = { ...process.env };
    delete env.CLAUDECODE;
    const child = spawn('claude', args, { cwd: project, env, stdio: ['ignore', 'pipe', 'ignore'] });
    child.stdout.setEncoding('utf8');
    const detector = createDetector(testName);
    let buffer = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      done({ ...result, registered: detector.registered });
    };
    const timer = setTimeout(() => finish({ chosen: undefined, error: 'timeout' }), timeoutMs);
    child.on('error', (err) => finish({ chosen: undefined, error: err.message }));
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const state = detector.feed(line);
        if (state.done) return finish({ chosen: state.chosen });
      }
    });
    child.on('close', () => finish({ chosen: undefined, error: 'claude exited without a result' }));
  });
}

async function pool(tasks, workers) {
  const results = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await tasks[i]();
      }
    }),
  );
  return results;
}

const pct = (v) => (v == null ? '-' : `${Math.round(v * 100)}%`);

export function toText(report) {
  const lines = [`Model: ${report.model}`, `Description tested:\n  ${report.description}`, ''];
  for (const [label, s] of [['Tuning', report.tuning], ['Held out', report.heldOut]]) {
    if (!s.total) continue;
    lines.push(`${label}: ${s.passed}/${s.total} correct, precision ${pct(s.precision)}, recall ${pct(s.recall)}`);
  }
  lines.push('');
  for (const r of report.results) {
    const ok = r.rate >= report.threshold === r.should_trigger ? 'PASS' : 'FAIL';
    const others = Object.entries(r.others)
      .map(([name, n]) => `${name}×${n}`)
      .join(', ');
    lines.push(
      `[${ok}] ${r.triggers}/${r.runs} want=${r.should_trigger ? 'yes' : 'no '}${r.heldOut ? ' (held out)' : ''}${others ? ` other: ${others}` : ''}${r.errors ? ` errors: ${r.errors}` : ''}  ${r.query.slice(0, 90)}`,
    );
  }
  return lines.join('\n');
}

export const main = async (argv) => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      triggers: { type: 'string' },
      description: { type: 'string' },
      model: { type: 'string' },
      runs: { type: 'string', default: '3' },
      workers: { type: 'string', default: '4' },
      timeout: { type: 'string', default: '90' },
      holdout: { type: 'string', default: '0.33' },
      threshold: { type: 'string', default: '0.5' },
      neighbours: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });
  const skillDir = positionals[0] && resolve(positionals[0]);
  if (!skillDir || !values.triggers) {
    console.error('Usage: run-triggers.mjs <skill-folder> --triggers <triggers.json> [--description "…"] [--model m] [--runs 3] [--holdout 0.33] [--neighbours <skills-folder>] [--json]');
    return 2;
  }
  const parsed = readSkillFile(readFileSync(join(skillDir, 'SKILL.md'), 'utf8'));
  if (parsed.error) throw new Error(parsed.error);
  const realName = String(parsed.data.name);
  const description = values.description ?? String(parsed.data.description);
  const queries = JSON.parse(readFileSync(values.triggers, 'utf8'));
  const runs = Number(values.runs);
  const holdout = Number(values.holdout);
  const threshold = Number(values.threshold);
  const testName = realName;
  const model = values.model ?? userModel();

  const { project, neighbourCount } = makeProject({ skillDir, name: testName, description, neighbours: values.neighbours && resolve(values.neighbours) });
  try {
    const tasks = queries.flatMap((q, qi) =>
      Array.from({ length: runs }, () => () =>
        runOnce({ query: q.query, project, testName, model, timeoutMs: Number(values.timeout) * 1000 }).then((r) => ({ qi, ...r })),
      ),
    );
    console.error(`Running ${queries.length} queries × ${runs} runs (${tasks.length} claude -p calls) with ${model ?? 'the default model'}, against ${neighbourCount} other skills…`);
    const raw = await pool(tasks, Number(values.workers));
    if (raw.length && raw.every((r) => r.registered === false)) {
      throw new Error('claude did not load the skill under test in any run; check the SKILL.md frontmatter.');
    }

    const results = queries.map((q, qi) => {
      const mine = raw.filter((r) => r.qi === qi);
      const others = {};
      for (const r of mine) {
        if (r.chosen && r.chosen !== testName) others[r.chosen] = (others[r.chosen] ?? 0) + 1;
      }
      const triggers = mine.filter((r) => r.chosen === testName).length;
      const valid = mine.filter((r) => !r.error).length;
      return {
        query: q.query,
        should_trigger: Boolean(q.should_trigger),
        heldOut: isHeldOut(q.query, holdout),
        triggers,
        runs: valid,
        rate: valid ? triggers / valid : 0,
        others,
        errors: mine.length - valid,
      };
    });
    const report = {
      skill: realName,
      description,
      model: model ?? '(claude default)',
      threshold,
      tuning: score(results.filter((r) => !r.heldOut), threshold),
      heldOut: score(results.filter((r) => r.heldOut), threshold),
      results,
    };
    const pluginCopy = results.flatMap((r) => Object.keys(r.others)).find((n) => n.endsWith(`:${realName}`));
    if (pluginCopy) console.error(`Note: the plugin copy "${pluginCopy}" was also picked; its description competes with the one tested.`);
    console.log(values.json ? JSON.stringify(report, null, 2) : toText(report));
    return 0;
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
};

if (resolve(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? '.')) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.message);
      process.exit(1);
    },
  );
}
