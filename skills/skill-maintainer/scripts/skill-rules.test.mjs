// node --test skills/skill-maintainer/scripts/
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  descriptionProblems,
  nameProblems,
  openaiProblems,
  placeholderProblems,
  readSkillFile,
} from './skill-rules.mjs';
import { summarize, toMarkdown } from './summarize-evals.mjs';
import { parseYamlSubset, YamlSubsetError } from './yaml-subset.mjs';

const scripts = dirname(fileURLToPath(import.meta.url));

describe('parseYamlSubset', () => {
  it('reads nested maps, lists of maps, quotes, booleans, numbers and comments', () => {
    const yaml = `interface:
  display_name: "Skill \\"Maker\\""
  short_description: 'It''s short' # comment
policy:
  allow_implicit_invocation: false
metadata:
  version: "1.0"
  count: 3
dependencies:
  tools:
    - type: "mcp"
      value: "github"
      url: "https://api.githubcopilot.com/mcp/"
    - type: mcp
empty:
`;
    assert.deepEqual(parseYamlSubset(yaml), {
      interface: { display_name: 'Skill "Maker"', short_description: "It's short" },
      policy: { allow_implicit_invocation: false },
      metadata: { version: '1.0', count: 3 },
      dependencies: {
        tools: [
          { type: 'mcp', value: 'github', url: 'https://api.githubcopilot.com/mcp/' },
          { type: 'mcp' },
        ],
      },
      empty: null,
    });
  });
  it('reads lists at the key indent, plain values with colons, and block scalars', () => {
    const yaml = `items:
- a
- https://example.org/x
text: |
  line one
  line two
folded: >-
  one
  two
url: https://example.org
`;
    assert.deepEqual(parseYamlSubset(yaml), {
      items: ['a', 'https://example.org/x'],
      text: 'line one\nline two\n',
      folded: 'one two',
      url: 'https://example.org',
    });
  });
  it('refuses what it does not support instead of misreading it', () => {
    for (const yaml of [
      'a: [1, 2]',
      'a: {b: c}',
      'a: &x 1',
      'a:\n\tb: c',
      'a: 1\na: 2',
      'a: "open',
      'a: 1\n  b: 2',
      '---\na: 1',
    ])
      assert.throws(() => parseYamlSubset(yaml), YamlSubsetError, yaml);
  });
});

describe('rules', () => {
  it('checks names like the Agent Skills spec', () => {
    assert.deepEqual(nameProblems('add-dhamma-post'), []);
    for (const bad of ['Add', 'a--b', '-a', 'a-', 'a_b', '', 'x'.repeat(65)])
      assert.notDeepEqual(nameProblems(bad), [], bad);
  });
  it('checks descriptions', () => {
    assert.deepEqual(descriptionProblems('Does x. Use when y.'), []);
    assert.notDeepEqual(descriptionProblems(''), []);
    assert.notDeepEqual(descriptionProblems('a <b>'), []);
    assert.notDeepEqual(descriptionProblems('x'.repeat(1025)), []);
  });
  it('reads SKILL.md frontmatter and body', () => {
    const { data, body } = readSkillFile(
      '---\nname: demo\ndescription: "Demo: does things. Use when testing."\n---\n\n# Demo\n',
    );
    assert.deepEqual(data, {
      name: 'demo',
      description: 'Demo: does things. Use when testing.',
    });
    assert.equal(body.trim(), '# Demo');
    assert.ok(readSkillFile('# no frontmatter').error);
    assert.ok(readSkillFile('\n---\nname: x\n---\n').error);
  });
  it('checks agents/openai.yaml', () => {
    const good = `interface:
  display_name: "Demo"
  short_description: "A demo skill for testing things"
  default_prompt: "Use $demo to test."
policy:
  allow_implicit_invocation: false
`;
    assert.deepEqual(openaiProblems(good, 'demo'), []);
    const bad = `interface:
  display_name: Demo
  short_description: "tiny"
  default_prompt: "Use it."
  colour: "red"
policy:
  allow_implicit_invocation: "no"
dependencies:
  tools:
    - type: "http"
`;
    const problems = openaiProblems(bad, 'demo').join('\n');
    for (const expected of [
      'unknown interface key "colour"',
      'short_description must be 25 to 64',
      'must mention $demo',
      'allow_implicit_invocation must be true or false',
      'type must be "mcp"',
      'write the string value in double quotes (Demo)',
    ])
      assert.match(problems, new RegExp(expected.replace(/[$()]/g, '\\$&')));
  });
  it('requires double quotes for every string in agents/openai.yaml', () => {
    const single = `interface:
  display_name: 'Demo'
  short_description: 'A demo skill for testing things'
  default_prompt: 'Use $demo to test.'
`;
    assert.equal(
      openaiProblems(single, 'demo').filter((p) => p.includes('double quotes')).length,
      3,
    );
    const block = `interface:
  display_name: "Demo"
  short_description: "A demo skill for testing things"
  default_prompt: >-
    Use $demo to test.
`;
    assert.match(openaiProblems(block, 'demo').join('\n'), /:4: write the string value in double quotes/);
  });
});

describe('placeholderProblems', () => {
  it('finds scaffold placeholders outside code fences only', () => {
    const body = '# X\n\n## Steps\n\n1. …\n\n## Checks\n\n- …\n\nSee [TODO: link].\n\n```md\n1. …\n```\n\n- Real step … with an ellipsis.\n';
    const problems = placeholderProblems(body);
    assert.equal(problems.length, 3, problems.join('\n'));
    assert.match(problems[0], /line 5: unfinished placeholder/);
  });
});

describe('summarize-evals', () => {
  it('aggregates grading.json and timing.json per configuration and flags weak expectations', () => {
    const dir = mkdtempSync(join(tmpdir(), 'evals-'));
    const write = (path, value) => {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), JSON.stringify(value));
    };
    const grading = (...passed) => ({
      expectations: passed.map((ok, i) => ({ text: ['has header', 'right totals'][i], passed: ok, evidence: '' })),
    });
    try {
      write('csv-totals/with_skill/grading.json', grading(true, true));
      write('csv-totals/with_skill/timing.json', { total_tokens: 1000, duration_ms: 4000 });
      write('csv-totals/without_skill/grading.json', grading(true, false));
      write('csv-totals/without_skill/timing.json', { total_tokens: 3000, duration_ms: 8000 });
      write('edge-case/with_skill/run-1/grading.json', grading(true, true));
      write('edge-case/with_skill/run-2/grading.json', grading(true, false));
      write('edge-case/without_skill/grading.json', grading(true, false));
      const summary = summarize(dir);
      assert.deepEqual(summary.configs, ['with_skill', 'without_skill']);
      assert.equal(summary.byConfig.with_skill.passRate.n, 3);
      assert.ok(Math.abs(summary.byConfig.with_skill.passRate.mean - 5 / 6) < 1e-9);
      assert.equal(summary.byConfig.without_skill.passRate.mean, 0.5);
      assert.equal(summary.byConfig.with_skill.tokens.mean, 1000);
      assert.equal(summary.byConfig.without_skill.seconds.mean, 8);
      assert.ok(Math.abs(summary.delta.passRate - 1 / 3) < 1e-9);
      const notes = summary.notes.join('\n');
      assert.match(notes, /csv-totals: "has header" passes in every configuration/);
      assert.match(notes, /edge-case \(with_skill\): pass rate varies/);
      const markdown = toMarkdown(summary);
      assert.match(markdown, /\| with_skill \| 3 \| 83 ± 29% \| 1000 \| 4\.0 \|/);
      assert.match(markdown, /with_skill vs without_skill: \+33 points/);
      const cli = spawnSync(process.execPath, [join(scripts, 'summarize-evals.mjs'), dir, '--json'], { encoding: 'utf8' });
      assert.equal(cli.status, 0, cli.stderr);
      assert.equal(JSON.parse(cli.stdout).evals.length, 2);
      assert.equal(spawnSync(process.execPath, [join(scripts, 'summarize-evals.mjs'), tmpdir() + '/missing-x'], { encoding: 'utf8' }).status, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/** A throwaway git repo with this skill's scripts copied in. */
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'skills-'));
  execFileSync('git', ['init', '-q', dir]);
  cpSync(scripts, join(dir, 'tools'), { recursive: true });
  return dir;
}
const run = (dir, script, args) =>
  spawnSync(process.execPath, [join(dir, 'tools', script), ...args], {
    cwd: dir,
    encoding: 'utf8',
  });
/** Replaces the scaffold placeholders, as an author would. */
const fillBody = (file) =>
  writeFileSync(
    file,
    readFileSync(file, 'utf8')
      .replace(/\n<!-- Imperative steps[\s\S]*?-->\n/, '')
      .replace('1. …', '1. Run the demo.')
      .replace('- …', '- The demo prints OK.'),
  );
const scaffold = (dir, extra = []) =>
  run(dir, 'new-skill.mjs', [
    'demo-skill',
    '--description',
    'Demo skill: does things. Use when testing.',
    '--display-name',
    'Demo Skill',
    '--short-description',
    'A demo skill for testing the checker',
    '--default-prompt',
    'Use $demo-skill to test.',
    ...extra,
  ]);

describe('new-skill and check-skills (project layout)', () => {
  it('scaffolds a valid skill with a relative .claude/skills symlink, and catches breakage', () => {
    const dir = repo();
    try {
      const made = scaffold(dir, ['--resources', 'references']);
      assert.equal(made.status, 0, made.stderr);
      assert.doesNotMatch(made.stderr, /placeholder/, 'new-skill does not report its own placeholders');
      const fresh = run(dir, 'check-skills.mjs', []);
      assert.equal(fresh.status, 1, 'placeholders fail the check');
      assert.match(fresh.stderr, /unfinished placeholder/);
      fillBody(join(dir, '.agents/skills/demo-skill/SKILL.md'));
      assert.equal(run(dir, 'check-skills.mjs', []).status, 0);

      // A reference nothing mentions is a warning, not an error.
      writeFileSync(join(dir, '.agents/skills/demo-skill/references/notes.md'), '# Notes\n');
      const unrouted = run(dir, 'check-skills.mjs', []);
      assert.equal(unrouted.status, 0);
      assert.match(unrouted.stderr, /references\/notes\.md is not mentioned in SKILL\.md/);
      rmSync(join(dir, '.agents/skills/demo-skill/references/notes.md'));
      assert.match(
        readFileSync(join(dir, '.agents/skills/demo-skill/SKILL.md'), 'utf8'),
        /^---\nname: demo-skill\ndescription: "Demo skill: does things\. Use when testing\."\n---/,
      );
      assert.equal(scaffold(dir).status, 1, 'refuses to overwrite');

      // A copy instead of the symlink.
      rmSync(join(dir, '.claude/skills/demo-skill'));
      cpSync(join(dir, '.agents/skills/demo-skill'), join(dir, '.claude/skills/demo-skill'), {
        recursive: true,
      });
      let check = run(dir, 'check-skills.mjs', []);
      assert.equal(check.status, 1);
      assert.match(check.stderr, /must be a symlink/);
      rmSync(join(dir, '.claude/skills/demo-skill'), { recursive: true });

      // An absolute symlink.
      symlinkSync(join(dir, '.agents/skills/demo-skill'), join(dir, '.claude/skills/demo-skill'));
      assert.match(run(dir, 'check-skills.mjs', []).stderr, /must be the relative link/);
      rmSync(join(dir, '.claude/skills/demo-skill'));
      symlinkSync('../../.agents/skills/demo-skill', join(dir, '.claude/skills/demo-skill'));
      assert.equal(run(dir, 'check-skills.mjs', []).status, 0);

      // Tool-only frontmatter, wrong name, broken link; --ignore skips the skill.
      const file = join(dir, '.agents/skills/demo-skill/SKILL.md');
      writeFileSync(
        file,
        readFileSync(file, 'utf8')
          .replace('name: demo-skill', 'name: demo\ndisable-model-invocation: true')
          .replace('## Steps', 'See [x](references/missing.md).\n\n## Steps'),
      );
      check = run(dir, 'check-skills.mjs', []);
      for (const expected of ['not portable', 'must equal the folder name', 'missing.md'])
        assert.match(check.stderr, new RegExp(expected));
      assert.equal(run(dir, 'check-skills.mjs', ['--ignore', 'demo-skill']).status, 0);

      // A skill only Claude can see.
      mkdirSync(join(dir, '.claude/skills/only-claude'));
      assert.match(
        run(dir, 'check-skills.mjs', ['--ignore', 'demo-skill']).stderr,
        /only-claude: no matching \.agents\/skills\/only-claude/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('eval files', () => {
  it('validates evals.json and triggers.json beside the skills folder, and finds stray evals', () => {
    const dir = repo();
    const evals = join(dir, '.agents/evals/demo-skill');
    const check = () => run(dir, 'check-skills.mjs', []);
    try {
      assert.equal(scaffold(dir).status, 0);
      fillBody(join(dir, '.agents/skills/demo-skill/SKILL.md'));
      mkdirSync(join(evals, 'files'), { recursive: true });
      writeFileSync(join(evals, 'files/in.csv'), 'a,b\n');
      writeFileSync(
        join(evals, 'evals.json'),
        JSON.stringify({
          skill_name: 'demo-skill',
          evals: [{ id: 1, prompt: 'Total the csv', files: ['files/in.csv'], expectations: ['Has a total'] }],
        }),
      );
      writeFileSync(
        join(evals, 'triggers.json'),
        JSON.stringify([
          { query: 'run the demo on my csv', should_trigger: true },
          { query: 'explain what a csv is', should_trigger: false },
        ]),
      );
      let result = check();
      assert.equal(result.status, 0, result.stderr);
      assert.doesNotMatch(result.stderr, /warning/);

      writeFileSync(
        join(evals, 'evals.json'),
        JSON.stringify({
          skill_name: 'other',
          evals: [{ id: 1, prompt: '' }, { id: 1, prompt: 'x', files: ['files/missing.csv'] }],
        }),
      );
      writeFileSync(join(evals, 'triggers.json'), JSON.stringify([{ query: 'only positive', should_trigger: true }]));
      mkdirSync(join(dir, '.agents/evals/gone-skill'));
      result = check();
      assert.equal(result.status, 1);
      for (const expected of [
        'skill_name must be "demo-skill"',
        'evals\\[0\\]\\.prompt is missing',
        'evals\\[1\\]\\.id must be a unique integer',
        'files/missing\\.csv does not exist',
        'include both should_trigger true and false',
        '\\.agents/evals/gone-skill: no skill named gone-skill',
      ])
        assert.match(result.stderr, new RegExp(expected));
      writeFileSync(join(evals, 'triggers.json'), '{ not json');
      assert.match(check().stderr, /triggers\.json: not valid JSON/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('catalog layout', () => {
  it('scaffolds into skills/<name>/ with no symlink and checks it', () => {
    const dir = repo();
    try {
      const made = scaffold(dir, ['--catalog', 'skills']);
      assert.equal(made.status, 0, made.stderr);
      assert.doesNotMatch(made.stdout, /Linked/);
      fillBody(join(dir, 'skills/demo-skill/SKILL.md'));
      const check = run(dir, 'check-skills.mjs', ['--catalog', 'skills']);
      assert.equal(check.status, 0, check.stderr);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
