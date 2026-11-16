#!/usr/bin/env node
// Checks pinned versions that Dependabot can't update (runtimes and CLIs in
// mise.toml, .tool-versions, .nvmrc, package.json engines, ...) against the
// newest LTS or release, as listed in a JSON config file.
//
// Usage: node check-versions.mjs [--config <file>]
//   --config  defaults to .github/version-check.json. Pin paths in it are
//             relative to the current directory (run from the repository root).
// Prints a Markdown report on stdout. Exit codes: 0 everything current,
// 1 something is behind, ahead or missing, 2 a bad config, a failed lookup or
// any other error (nothing is printed on stdout then).
// Set GITHUB_TOKEN to avoid GitHub API rate limits.
// Needs Node 20 or later and no packages.
// From the dependency-updates skill: https://github.com/winmetta/agent-skills
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCES = {
  'node-lts': () => ({
    url: 'https://nodejs.org/dist/index.json',
    pick: (index) => {
      const release = index.find((r) => r.lts);
      if (!release) throw new Error('no LTS release in the Node.js index');
      return `${release.version} (LTS ${release.lts})`;
    },
  }),
  'github-release': ({ repo }) => ({
    url: `https://api.github.com/repos/${repo}/releases/latest`,
    pick: (release) => release.tag_name,
  }),
  npm: ({ package: name }) => ({
    url: `https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`,
    pick: (manifest) => manifest.version,
  }),
  pypi: ({ package: name }) => ({
    url: `https://pypi.org/pypi/${name}/json`,
    pick: (data) => data.info.version,
  }),
};
const MATCHES = ['major', 'minor', 'exact'];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The numeric parts of the first version in a value or range:
// "24" -> [24], ">=24 <25" -> [24], "^3.2.1" -> [3, 2, 1], "lts" -> null.
export function versionParts(value) {
  const match = /\d+(?:\.\d+)*/.exec(value ?? '');
  return match ? match[0].split('.').map(Number) : null;
}

// Reads one pin from a file's text. A pin names its file and at most one of:
// "mise" (a tool in mise.toml), "tool" (a line in .tool-versions),
// "json" (a key path in a JSON file) or "regex" (the first capture group).
// With none of them the whole file is the value (.nvmrc, .python-version).
export function readPin(pin, text) {
  if (pin.mise) {
    const re = new RegExp(`^\\s*"?${escape(pin.mise)}"?\\s*=\\s*(?:\\{[^}]*version\\s*=\\s*)?"([^"]+)"`, 'm');
    return re.exec(text)?.[1] ?? null;
  }
  if (pin.tool) {
    const re = new RegExp(`^\\s*${escape(pin.tool)}\\s+(\\S+)`, 'm');
    return re.exec(text)?.[1] ?? null;
  }
  if (pin.json) {
    let value = JSON.parse(text);
    for (const key of pin.json) value = value?.[key];
    return typeof value === 'string' ? value : null;
  }
  if (pin.regex) return new RegExp(pin.regex, 'm').exec(text)?.[1] ?? null;
  return text.trim() || null;
}

// A support floor with no upper bound: ">=20", ">= 20.11", ">=v20".
const isFloor = (value) => /^\s*>=?\s*v?\d+(?:\.\d+)*\s*$/.test(value);

// "current", "behind", "ahead", "missing" or "floating" (no number, e.g. "lts").
// A floor below the latest version is "current": the latest still satisfies it.
export function status(pinned, latest, match) {
  if (pinned == null) return 'missing';
  const have = versionParts(pinned);
  const want = versionParts(latest);
  if (!have) return 'floating';
  if (isFloor(pinned)) {
    const result = status(pinned.replace(/^\s*>=?\s*/, ''), latest, match);
    return result === 'behind' ? 'current' : result;
  }
  const length = { major: 1, minor: 2, exact: Math.max(have.length, want.length) }[match];
  for (let i = 0; i < length; i += 1) {
    const a = have[i] ?? 0;
    const b = want[i] ?? 0;
    if (a !== b) return a < b ? 'behind' : 'ahead';
  }
  return 'current';
}

// The field each source needs in "latest", besides "source".
const SOURCE_FIELD = { 'github-release': 'repo', npm: 'package', pypi: 'package' };

// Problems with one check, each as a message without the check's location.
function checkErrors(check) {
  const source = check?.latest?.source;
  const field = SOURCE_FIELD[source];
  const pins = Array.isArray(check?.pins) ? check.pins : [];
  return [
    !check?.name && '"name" is required',
    !SOURCES[source] && `"latest.source" must be one of ${Object.keys(SOURCES).join(', ')}`,
    field && !check.latest[field] && `${source} needs "${field}"`,
    check?.match && !MATCHES.includes(check.match) && `"match" must be one of ${MATCHES.join(', ')}`,
    !pins.length && '"pins" must be a non-empty array',
    ...pins.flatMap((pin, i) => pinErrors(pin).map((e) => `pins[${i}]: ${e}`)),
  ].filter(Boolean);
}

const PIN_KINDS = ['mise', 'tool', 'json', 'regex'];
const isText = (value) => typeof value === 'string' && value !== '';

// Problems with one pin, so that reading it later can't throw on a wrong type.
function pinErrors(pin) {
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) return ['must be an object'];
  const kinds = PIN_KINDS.filter((kind) => pin[kind] !== undefined);
  return [
    !isText(pin.file) && '"file" must be a non-empty string',
    ...['mise', 'tool', 'regex', 'label']
      .filter((key) => pin[key] !== undefined && !isText(pin[key]))
      .map((key) => `"${key}" must be a non-empty string`),
    pin.json !== undefined &&
      !(Array.isArray(pin.json) && pin.json.length && pin.json.every(isText)) &&
      '"json" must be a non-empty array of strings',
    isText(pin.regex) && !compiles(pin.regex) && '"regex" is not a valid regular expression',
    kinds.length > 1 && `use at most one of ${PIN_KINDS.join(', ')} (found ${kinds.join(', ')})`,
  ].filter(Boolean);
}

function compiles(pattern) {
  try {
    new RegExp(pattern, 'm');
    return true;
  } catch {
    return false;
  }
}

export function validate(config) {
  const checks = Array.isArray(config?.checks) ? config.checks : [];
  if (!checks.length) return ['"checks" must be a non-empty array'];
  const names = checks.map((check) => check?.name);
  const repeated = new Set(names.filter((name, i) => name && names.indexOf(name) !== i));
  return [
    ...[...repeated].map((name) => `check name "${name}" is used twice`),
    ...checks.flatMap((check, i) =>
      checkErrors(check).map((e) => `checks[${i}]${check?.name ? ` (${check.name})` : ''}: ${e}`),
    ),
  ];
}

// One row per pin. `latest` maps each check name to its looked-up version;
// `readFile` returns a file's text or throws.
export function compare(config, latest, readFile) {
  return config.checks.flatMap((check) =>
    check.pins.map((pin) => {
      let pinned = null;
      try {
        pinned = readPin(pin, readFile(pin.file));
      } catch {
        pinned = null;
      }
      const where = pin.label ?? [pin.file, pin.mise ?? pin.tool ?? pin.json?.join('.')].filter(Boolean).join(' ');
      const state = status(pinned, latest[check.name], check.match ?? 'major');
      return { item: check.name, where, pinned: pinned ?? '(missing)', latest: latest[check.name], state };
    }),
  );
}

export const isOk = (row) => row.state === 'current' || row.state === 'floating';

export function report(rows, date, configPath) {
  const off = rows.filter((row) => !isOk(row));
  return [
    off.length ? `${off.length} pinned version(s) need attention.` : 'All checked versions are current.',
    '',
    '| Item | Where | Pinned | Latest | Status |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.item} | \`${r.where}\` | \`${r.pinned}\` | \`${r.latest}\` | ${isOk(r) ? r.state : `**${r.state}**`} |`),
    '',
    `Checked ${date} against the sources in \`${configPath}\`. Package dependencies are updated by Dependabot.`,
  ].join('\n');
}

async function lookup(check) {
  const { url, pick } = SOURCES[check.latest.source](check.latest);
  const headers = { 'user-agent': 'dependency-updates-version-check' };
  if (url.startsWith('https://api.github.com/') && process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return pick(await response.json());
}

// Exit code 2 for anything unexpected too: exit 1 would make the workflow
// replace the issue's body with an empty or partial report.
export async function main(argv) {
  try {
    return await run(argv);
  } catch (error) {
    console.error(`Unexpected error: ${error?.stack ?? error}`);
    return 2;
  }
}

async function run(argv) {
  const at = argv.indexOf('--config');
  const configPath = at >= 0 ? argv[at + 1] : '.github/version-check.json';
  if (!configPath || argv.some((a) => a.startsWith('-') && a !== '--config')) {
    console.error('Usage: node check-versions.mjs [--config <file>]');
    return 2;
  }
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error(`Cannot read ${configPath}: ${error.message}`);
    return 2;
  }
  const errors = validate(config);
  if (errors.length) {
    for (const e of errors) console.error(`${configPath}: ${e}`);
    return 2;
  }
  const latest = {};
  try {
    await Promise.all(config.checks.map(async (check) => (latest[check.name] = await lookup(check))));
  } catch (error) {
    console.error(`Version lookup failed: ${error.message}`);
    return 2;
  }
  const rows = compare(config, latest, (file) => readFileSync(file, 'utf8'));
  console.log(report(rows, new Date().toISOString().slice(0, 10), configPath));
  return rows.every(isOk) ? 0 : 1;
}

// Compare file paths, not URLs: import.meta.url percent-encodes spaces, process.argv[1] does not.
if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  process.exitCode = await main(process.argv.slice(2));
}
