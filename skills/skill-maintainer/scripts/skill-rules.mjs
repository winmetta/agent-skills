// Rules for skills shared by Claude Code and Codex (see ../references/formats.md), used by
// check-skills.mjs and new-skill.mjs. No dependencies beyond Node 20+.
//
// Two layouts:
//   project (default): real files in .agents/skills/<name>/, and .claude/skills/<name> is a
//                      relative symlink to ../../.agents/skills/<name>.
//   catalog:           a skills repo publishing skills from one folder (e.g. skills/<name>/), no
//                      symlinks; selected with --catalog <dir>.
// Evals for a skill live beside the skills folder, never inside the skill, so installers do not
// ship them: .agents/evals/<name>/ (project) or evals/<name>/ (catalog skills/).
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseYamlSubset } from './yaml-subset.mjs';

/** The git repository containing the working directory (or the directory itself). */
export function findRoot(cwd = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return cwd;
  }
}

/** Where skills live: `{ root, skillsDir, linkDir, evalsDir }`; linkDir is null in a catalog. */
export function layout({ root = findRoot(), catalog } = {}) {
  const skillsDir = catalog ? catalog.replace(/\/+$/, '') : '.agents/skills';
  const parent = dirname(skillsDir);
  return {
    root,
    skillsDir,
    linkDir: catalog ? null : '.claude/skills',
    evalsDir: parent === '.' ? 'evals' : `${parent}/evals`,
  };
}

/** The symlink target, relative to the link folder. */
export const linkTarget = (where, name) =>
  `${where.linkDir
    .split('/')
    .map(() => '..')
    .join('/')}/${where.skillsDir}/${name}`;

/** Keys both tools accept (OpenAI's skill-creator validator allows no others). */
export const frontmatterKeys = [
  'name',
  'description',
  'license',
  'allowed-tools',
  'metadata',
];
export const interfaceKeys = [
  'display_name',
  'short_description',
  'icon_small',
  'icon_large',
  'brand_color',
  'default_prompt',
];
const openaiKeys = ['interface', 'policy', 'dependencies'];
/** Files OpenAI's skill-creator says not to put in a skill. */
const extraneous = /^(readme|changelog|installation_guide|quick_reference)\.md$/i;

export function nameProblems(name) {
  const problems = [];
  if (!/^[a-z0-9-]+$/.test(name))
    problems.push('use lowercase letters, digits and hyphens only');
  if (/^-|-$|--/.test(name))
    problems.push('no leading, trailing or double hyphen');
  if (name.length < 1 || name.length > 64)
    problems.push('must be 1 to 64 characters');
  return problems;
}

export function descriptionProblems(description) {
  const problems = [];
  const text = typeof description === 'string' ? description.trim() : '';
  if (!text) problems.push('description is missing or empty');
  if (text.length > 1024)
    problems.push(`description is ${text.length} characters (maximum 1024)`);
  if (/[<>]/.test(text))
    problems.push('description may not contain < or > (Codex rejects them)');
  return problems;
}

export function shortDescriptionProblems(value) {
  return typeof value === 'string' && value.length >= 25 && value.length <= 64
    ? []
    : ['interface.short_description must be 25 to 64 characters'];
}

/** Splits SKILL.md into frontmatter (parsed) and body; the frontmatter must open on line 1. */
export function readSkillFile(text) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(
    text.replace(/\r\n?/g, '\n'),
  );
  if (!match)
    return {
      error: 'SKILL.md must start with a --- frontmatter block on line 1',
    };
  try {
    const data = parseYamlSubset(match[1] ?? '');
    if (!data || typeof data !== 'object' || Array.isArray(data))
      return { error: 'frontmatter must be a YAML mapping' };
    return { data, body: match[2] ?? '' };
  } catch (error) {
    return { error: `frontmatter: ${error.message}` };
  }
}

export function openaiProblems(text, name) {
  const problems = [];
  let data;
  try {
    data = parseYamlSubset(text);
  } catch (error) {
    return [`agents/openai.yaml: ${error.message}`];
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return ['agents/openai.yaml must be a YAML mapping'];
  for (const key of Object.keys(data))
    if (!openaiKeys.includes(key))
      problems.push(
        `agents/openai.yaml: unknown top-level key "${key}" (allowed: ${openaiKeys.join(', ')})`,
      );
  const ui = data.interface ?? {};
  for (const key of Object.keys(ui))
    if (!interfaceKeys.includes(key))
      problems.push(`agents/openai.yaml: unknown interface key "${key}"`);
  for (const key of ['display_name', 'short_description', 'default_prompt'])
    if (typeof ui[key] !== 'string' || !ui[key].trim())
      problems.push(`agents/openai.yaml: interface.${key} is missing`);
  if (ui.short_description !== undefined)
    problems.push(
      ...shortDescriptionProblems(ui.short_description).map(
        (p) => `agents/openai.yaml: ${p}`,
      ),
    );
  if (
    typeof ui.default_prompt === 'string' &&
    !ui.default_prompt.includes(`$${name}`)
  )
    problems.push(
      `agents/openai.yaml: interface.default_prompt must mention $${name}`,
    );
  const policy = data.policy;
  if (policy !== undefined) {
    if (typeof policy !== 'object' || Array.isArray(policy) || policy === null)
      problems.push('agents/openai.yaml: policy must be a mapping');
    else {
      for (const key of Object.keys(policy))
        if (key !== 'allow_implicit_invocation')
          problems.push(`agents/openai.yaml: unknown policy key "${key}"`);
      if (
        'allow_implicit_invocation' in policy &&
        typeof policy.allow_implicit_invocation !== 'boolean'
      )
        problems.push(
          'agents/openai.yaml: policy.allow_implicit_invocation must be true or false',
        );
    }
  }
  for (const tool of data.dependencies?.tools ?? [])
    if (tool?.type !== 'mcp')
      problems.push(
        'agents/openai.yaml: dependencies.tools[].type must be "mcp" (the only supported type)',
      );
  // OpenAI's guidance, as its generator writes it: every string value in double quotes (not
  // single quotes, plain text or block scalars). Booleans and numbers stay bare.
  for (const [index, line] of text.split('\n').entries()) {
    const value = /^\s*-?\s*[A-Za-z_][\w-]*:\s+(.+?)\s*(#.*)?$/.exec(line)?.[1];
    if (value && !/^"|^(true|false|-?\d+(\.\d+)?)$/.test(value))
      problems.push(
        `agents/openai.yaml:${index + 1}: write the string value in double quotes (${value.slice(0, 30)})`,
      );
  }
  return problems;
}

/** Text new-skill.mjs writes for the author to replace; prose inside code fences is ignored. */
export function placeholderProblems(body) {
  const problems = [];
  let fence = null;
  for (const [index, line] of body.split('\n').entries()) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    if (/^\s*(?:\d+\.|-)\s+(?:…|\.\.\.|TODO\b.*)\s*$|\[TODO\b/.test(line) || line.includes('<!-- Imperative steps another agent'))
      problems.push(`SKILL.md body line ${index + 1}: unfinished placeholder "${line.trim().slice(0, 40)}"`);
  }
  return problems;
}

/** Files in references/ that neither SKILL.md nor another reference mentions, so no agent reads them. */
export function unroutedReferences(dir, skillText) {
  const refs = join(dir, 'references');
  if (!existsSync(refs)) return [];
  const files = readdirSync(refs).filter((file) => !file.startsWith('.'));
  const texts = files.map((file) => readFileSync(join(refs, file), 'utf8'));
  return files.filter(
    (file, i) =>
      !skillText.includes(`references/${file}`) &&
      !texts.some((text, j) => j !== i && text.includes(file)),
  );
}

const isText = (value) => typeof value === 'string' && value.trim() !== '';

/** Problems with <evalsDir>/<name>/evals.json (task evals) and triggers.json (description tests). */
export function evalProblems(where, name) {
  const errors = [];
  const warnings = [];
  const dir = join(where.root, where.evalsDir, name);
  const shown = `${where.evalsDir}/${name}`;
  const read = (file) => {
    const path = join(dir, file);
    if (!existsSync(path)) return undefined;
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      errors.push(`${shown}/${file}: not valid JSON (${error.message})`);
      return null;
    }
  };
  const tasks = read('evals.json');
  if (tasks) {
    const at = (message) => errors.push(`${shown}/evals.json: ${message}`);
    if (tasks.skill_name !== name) at(`skill_name must be "${name}"`);
    if (!Array.isArray(tasks.evals) || !tasks.evals.length) at('evals must be a non-empty list');
    const ids = new Set();
    for (const [index, item] of (Array.isArray(tasks.evals) ? tasks.evals : []).entries()) {
      const label = `evals[${index}]`;
      if (!Number.isInteger(item?.id) || ids.has(item.id)) at(`${label}.id must be a unique integer`);
      ids.add(item?.id);
      if (!isText(item?.prompt)) at(`${label}.prompt is missing`);
      for (const key of ['files', 'expectations'])
        if (item?.[key] !== undefined && !(Array.isArray(item[key]) && item[key].every(isText)))
          at(`${label}.${key} must be a list of strings`);
      for (const file of Array.isArray(item?.files) ? item.files : [])
        if (isText(file) && !existsSync(resolve(dir, file)))
          at(`${label}.files: ${file} does not exist (paths are relative to ${shown}/)`);
    }
  }
  const triggers = read('triggers.json');
  if (triggers) {
    const at = (message) => errors.push(`${shown}/triggers.json: ${message}`);
    if (!Array.isArray(triggers) || !triggers.length) at('must be a non-empty list of { query, should_trigger }');
    else {
      for (const [index, item] of triggers.entries())
        if (!isText(item?.query) || typeof item?.should_trigger !== 'boolean')
          at(`[${index}] needs a query string and should_trigger true or false`);
      const kinds = new Set(triggers.map((item) => item?.should_trigger));
      if (!kinds.has(true) || !kinds.has(false))
        warnings.push(`${shown}/triggers.json: include both should_trigger true and false queries`);
    }
  }
  return { errors, warnings };
}

/** Problems with one skill folder; `warnings` do not fail the check. */
export function checkSkill(where, name) {
  const errors = [];
  const warnings = [];
  const shown = `${where.skillsDir}/${name}`;
  const dir = join(where.root, where.skillsDir, name);
  const at = (message) => `${shown}: ${message}`;
  for (const problem of nameProblems(name))
    errors.push(at(`folder name: ${problem}`));

  const skillFile = join(dir, 'SKILL.md');
  if (!existsSync(skillFile)) {
    errors.push(at('SKILL.md is missing'));
    return { errors, warnings };
  }
  const text = readFileSync(skillFile, 'utf8');
  const parsed = readSkillFile(text);
  if (parsed.error) errors.push(at(parsed.error));
  else {
    const { data, body } = parsed;
    for (const key of Object.keys(data))
      if (!frontmatterKeys.includes(key))
        errors.push(
          at(
            `frontmatter key "${key}" is not portable (allowed: ${frontmatterKeys.join(', ')}); see references/formats.md`,
          ),
        );
    if (data.name !== name)
      errors.push(
        at(`frontmatter name "${data.name}" must equal the folder name`),
      );
    for (const problem of descriptionProblems(data.description))
      errors.push(at(problem));
    if (!body.trim())
      errors.push(at('SKILL.md has no instructions after the frontmatter'));
    const lines = text.split('\n').length;
    if (lines > 500)
      warnings.push(
        at(
          `SKILL.md is ${lines} lines; move detail to references/ (aim for under 500)`,
        ),
      );
    // Relative links from SKILL.md must point at files that exist.
    for (const [, target] of body.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/'))
        continue;
      if (!existsSync(resolve(dir, target)))
        errors.push(at(`SKILL.md links to ${target}, which does not exist`));
    }
    errors.push(...placeholderProblems(body).map(at));
    for (const file of unroutedReferences(dir, body))
      warnings.push(
        at(`references/${file} is not mentioned in SKILL.md, so agents will not know to read it`),
      );
  }

  const evals = evalProblems(where, name);
  errors.push(...evals.errors);
  warnings.push(...evals.warnings);

  const openaiFile = join(dir, 'agents/openai.yaml');
  if (!existsSync(openaiFile))
    warnings.push(
      at('agents/openai.yaml is missing (Codex UI metadata; recommended)'),
    );
  else
    errors.push(
      ...openaiProblems(readFileSync(openaiFile, 'utf8'), name).map(at),
    );

  for (const entry of readdirSync(dir))
    if (extraneous.test(entry))
      warnings.push(
        at(`${entry} does not belong in a skill (put instructions in SKILL.md)`),
      );

  if (where.linkDir) errors.push(...linkProblems(where, name));
  return { errors, warnings };
}

function linkProblems(where, name) {
  const link = join(where.root, where.linkDir, name);
  const shown = `${where.linkDir}/${name}`;
  const target = linkTarget(where, name);
  let stat;
  try {
    stat = lstatSync(link);
  } catch {
    return [`${shown}: missing; run: ln -s ${target} ${shown}`];
  }
  if (!stat.isSymbolicLink())
    return [
      `${shown}: must be a symlink to ${target}, not a copy (the real files live in ${where.skillsDir}/${name})`,
    ];
  const actual = readlinkSync(link).replace(/\/+$/, '');
  return actual === target
    ? []
    : [
        `${shown}: points to ${actual}; it must be the relative link ${target}`,
      ];
}

/** Skill folders, and stray entries (Claude folder or evals folder) with no matching skill. */
export function listSkills(where) {
  const skillsPath = join(where.root, where.skillsDir);
  const names = existsSync(skillsPath)
    ? readdirSync(skillsPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
        .map((entry) => entry.name)
        .filter((name) => !name.startsWith('.'))
        .sort()
    : [];
  const linkPath = where.linkDir ? join(where.root, where.linkDir) : undefined;
  const strays =
    linkPath && existsSync(linkPath)
      ? readdirSync(linkPath).filter(
          (entry) => !names.includes(entry) && !entry.startsWith('.'),
        )
      : [];
  const evalsPath = join(where.root, where.evalsDir);
  const evalStrays = existsSync(evalsPath)
    ? readdirSync(evalsPath).filter(
        (entry) => !names.includes(entry) && !entry.startsWith('.'),
      )
    : [];
  return { names, strays, evalStrays };
}
