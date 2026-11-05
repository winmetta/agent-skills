---
name: local-change-review
description: "Review local changes (code, docs, config, infrastructure etc.) for bugs, broken repository rules, docs that no longer match, risky infrastructure or config changes and functions that are too complex, before they are committed or pushed. Before a commit, it fixes the findings and reviews again until none are left. Use whenever the user asks to review, check or look over their changes, diff, staged files, working tree, recent commits or branch for bugs or problems, including documentation, config and infrastructure-as-code edits, or asks whether code they just wrote is too complex, even as a quick or casual request, and when project instructions require a review before every commit. Reviews uncommitted work by default, or staged changes, recent commits, a range or a whole branch when asked; reports only problems the change introduces, each with a concrete failing case, and rechecks every finding before reporting it. Not for posting a review to a GitHub pull request (use local-pr-review)."
---

# Local change review

Reviews a change in the local checkout (code, docs, config, infrastructure etc.) and prints the findings. Before a commit it also fixes them (see [Before a commit](#before-a-commit-fix-until-clean)); otherwise it changes no files. It posts nothing. To review a GitHub pull request and post the findings as a bot, use `local-pr-review` instead; it uses the same rubric.

Follow [references/review-rubric.md](references/review-rubric.md) for what to report, what to leave out, the evidence bar, the docs, config and infrastructure checks, and the complexity rules. Read it before reviewing.

## Steps

1. **Pick the change.** Use what the user asked for; otherwise review uncommitted work. State the scope you used in the result.

   | Asked for | Diff to review |
   | --- | --- |
   | nothing (default): uncommitted work | `git diff HEAD`, plus each untracked file from `git ls-files --others --exclude-standard` read in full |
   | staged changes | `git diff --cached` |
   | the last N commits | `git diff HEAD~N` (add `HEAD` to exclude uncommitted work: `git diff HEAD~N HEAD`) |
   | a commit or range | `git show <sha>`, or `git diff <a>..<b>` |
   | this branch | `git diff <base>...HEAD`, where `<base>` is the default branch: `git symbolic-ref --short refs/remotes/origin/HEAD` (fall back to asking the user, never assume `main`) |

   If the diff is empty, say so and stop. In a repository with no commits yet, review the untracked files.
2. **Read the rules:** the repository's `AGENTS.md`, `CLAUDE.md` and `CONTRIBUTING.md` along each changed file's path, as the rubric describes.
3. **Measure complexity** as in the rubric's "Complexity" section. First look for the repository's own tool or rules:

   ```bash
   git grep -nIiE 'complexity|C901|PLR09(12|13|15)|max-depth|max-lines-per-function|max-params|lizard|radon|xenon|complexipy|shellmetrics' -- \
     ':(glob)**/*.toml' ':(glob)**/*.cfg' ':(glob)**/*.ini' ':(glob)**/package.json' ':(glob)**/eslint.config.*' \
     ':(glob)**/.eslintrc*' ':(glob)**/Makefile' ':(glob)**/.pre-commit-config.yaml' ':(glob)**/lefthook.yml' ':(glob)**/.github/workflows/*'
   ```

   If it finds a rule, run that linter on the changed files with the repository's settings (for ruff, `ruff check --select C901 <files>` from the repository root picks up its `pyproject.toml`). Use the copy the repository installs or pins (its `node_modules/.bin`, virtualenv, `mise` or `uv` setup); do not install a tool the repository does not use. If nothing is found, or it can't run, count by hand and say which you did.
4. **Review** the diff. Read the full changed files, their callers and the code they call (for docs, the code and commands they describe; for config and infrastructure, what reads or deploys them) before you report anything. While reviewing, change no files and run nothing that writes (no installs, builds, formatters with `--fix`, or git commands that change state).
5. **Verify each candidate finding** in a fresh context, so the check is independent of the review:
   - Give the checker only the finding (title, body, `path:line`) and access to the repository, with this instruction: "Check this code review finding against the code. Reply KEEP if it is real, introduced by the change, and meets the evidence bar in the rubric; otherwise DROP. Give a one-line reason."
   - Use a mid-tier model at low reasoning. In Claude Code, start a subagent with model `sonnet` and low effort. In Codex, run `codex exec -m gpt-6.1-terra -c model_reasoning_effort="low" --sandbox read-only --ephemeral -` with the instruction on standard input (`gpt-6.1-terra` was current on 2026-11-04; use the current Terra model from `/model` if it has changed).
   - Always use the checker when the agent has subagents or `codex exec`; Claude Code and Codex both do. Only an agent with neither may recheck each finding itself in a separate pass, and it must say so in the result.
   - Report only the findings it keeps. Mention how many were dropped.
6. **Print the result:**
   - The scope reviewed and the files read.
   - Findings, most severe first: `[severity] title`, `path:line`, then the body and the suggested fix.
   - If there are none, say "No findings" plainly.

   For a review on its own, offer to fix the findings, but don't change anything until the user asks. Before a commit, fix them as below.

## Before a commit: fix until clean

When the review is a step before a commit (the user asked you to commit, or the project's instructions require a review before every commit), fix the findings without asking, then commit only what is clean:

1. Follow the steps above for the changes going into the commit: the staged changes, or uncommitted work if everything is committed.
2. Fix every finding kept in step 5, keeping each fix to the problem the finding describes. If a fix needs a decision only the user can make, stop and ask instead of guessing. For a complexity finding, keep the refactor inside the function it names and keep its behaviour the same; if the repository's tests fail afterwards, revert that fix and report the finding instead. A finding left this way does not block the commit: leave it out of later rounds and name it in the reply. Stage the fixes too when the scope is staged changes.
3. Review again, with the same scope, now including the fixes. Repeat until a round has no findings. If the same problem keeps coming back after three rounds, stop, and don't commit: tell the user what is left.
4. Commit only if the user asked for a commit, or the project's instructions allow it (for example, committing fixes for a pull request's review findings). Say in the reply what each round found and what you fixed.

## Checks

- Report nothing the change did not introduce. Pre-existing problems belong in a separate task, not in the review.
- When the user wants the findings posted to a pull request, hand over to `local-pr-review`. Its findings file uses the same fields as the rubric's "Writing findings" section.
