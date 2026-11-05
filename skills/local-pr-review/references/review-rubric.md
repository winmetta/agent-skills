# Review rubric

Shared by `local-change-review` and `local-pr-review`; the two copies must stay identical.

You already know what bugs and security holes look like. This rubric is about what to leave out and how sure to be, because every finding costs the author time to read, check and answer.

## Scope

- Review what the change adds or makes worse: the added and removed lines, and code they make newly reachable or newly wrong. Read as much surrounding code and as many callers as you need, but report on the change.
- Do not report problems that were already there, unless the change makes them worse or easier to hit.

## Do not report

- Style, formatting, naming or import order.
- Anything the repository's linters, formatters or type checker already enforce, and code they are told to ignore (`eslint-disable`, `# noqa`, `# shellcheck disable=`, `@ts-expect-error` with a reason).
- Preferences with no concrete failure ("I would have…", "consider using…").
- Changes the commit messages, PR description or comments say are intentional.
- Speculation about code you did not read ("this might break callers"): find the callers or drop it.
- Requests to "verify", "ensure" or "double-check" something. Check it yourself, then report what you found or nothing.
- A restatement of what the code does, praise, or a summary of the change.

## Evidence bar

Report a finding only if all of these hold:

- **Bug:** you can name the input or state that triggers it and what goes wrong. "Breaks callers" needs the caller's `path:line`.
- **Repository rule:** you can quote the rule and name the file it comes from.
- **Docs:** the doc's `path:line` and the code, command or other doc it contradicts, or the link or path that does not resolve.
- **Config or infrastructure:** the setting or resource, and what happens when it is applied or deployed (what gets replaced, opened, exposed or billed).
- **Complexity:** a measured number from the repository's tool, or counts you made under "Complexity" below.
- **Worth fixing:** the author would fix it if told, and the fix needs no more rigour than the rest of the codebase has.

## Repository rules

Read `AGENTS.md`, `CLAUDE.md` and `CONTRIBUTING.md` at the repository root and in the directories of each changed file, up to the root. A rule in a nearer file wins for the files under it. Report a broken rule only when the change breaks it.

## Docs, config and infrastructure

Changes that are not code get the same scope and evidence bar. Report, when the change causes it:

- **Docs:** a statement that contradicts the code, a command or another doc in the repository; a command, flag, path, link or anchor that no longer works as written; steps left out of order or missing a prerequisite the reader needs. Check them as far as your tools allow: read the code, resolve the paths, and run read-only commands only where you are allowed to.
- **Config:** a value the program does not read or rejects, a key renamed on one side only, a default changed without the callers that rely on it, settings that differ between environments by mistake.
- **Infrastructure as code** (Terraform, Pulumi, CloudFormation, Kubernetes, CI workflows, Dockerfiles): a resource that will be destroyed or replaced, data that can be lost, network or IAM access opened wider than needed, a secret in plain text, a large cost increase, a pinned version or image dropped, or a workflow that now runs with more permissions or on untrusted input. Use the repository's own plan or preview output when it is available; don't apply anything.

Do not report wording, tone or formatting in docs, or values that are a matter of choice (instance size, timeouts) without a concrete failure.

## Complexity

Report a function the change adds, or makes longer or more branched, when it is too complex. Do not report functions the change leaves as they were.

1. **Use the repository's own tool when it has one.** Look in lint configs (`eslint.config.*`, `.eslintrc*`, `pyproject.toml`, `ruff.toml`, `setup.cfg`), `package.json` scripts, `Makefile`, `mise.toml` tasks, pre-commit or lefthook hooks and CI workflows for complexity rules or tools: ESLint `complexity`, `max-depth`, `max-lines-per-function`, `max-params`, `sonarjs/cognitive-complexity`, ruff `C901` or `PLR0912`/`PLR0913`/`PLR0915`, lizard, radon, xenon, complexipy, shellmetrics. Run it the way the repository does, on the changed files, using the repository's thresholds. If it can't run (not installed, needs a build), say so and use the next step.
2. **Otherwise count yourself.** Flag a function that, after the change, has any of:
   - more than about 10 decision points: `if`/`elif`/`else if`, each `case` or `match` arm, loops, `catch`/`except`, ternaries, `&&`/`||`/`and`/`or` in conditions (in shell, `&&`/`||` chains too);
   - nesting deeper than 3 levels of blocks;
   - more than about 60 lines of code;
   - more than 5 parameters.
3. **Report** the function, the numbers, and one concrete refactor that fits it: guard clauses or early returns, extracting a named step, a lookup table instead of a long `if`/`case` chain, or splitting a function that does two jobs. Severity is `low`, or `medium` when it is far over (twice a threshold) or the code is hard to test. Never `high`.

These thresholds follow common defaults: McCabe's limit of 10 (NIST SP 500-235), ESLint `max-depth` 4 and `max-lines-per-function` 50, and ruff/Pylint `max-args` 5 (checked 2026-11-04).

## Writing findings

- **Severity:** `high` for a bug that loses data, breaks a contract or opens a security hole on a realistic path; `medium` for a likely bug, a broken repository rule or a missing test for changed behaviour; `low` for minor but real issues and complexity. Not everything is `high`.
- **Title:** the problem in one line, not the fix.
- **Body:** what is wrong, the failing case, and how to fix it, quoting at most a few lines of code.
- **Location:** `path` relative to the repository root and `line` in the new version of the file (`side: RIGHT`), or the old version for a removed line (`side: LEFT`), with `start_line` for a range.
- **Suggestion:** only when you know the exact replacement for those lines.
- One finding per problem. Report a repeated problem once and list every place it occurs.
- No findings is a valid result.
