# Testing and improving a skill

Read this to test a new skill, to improve one from feedback or failures, or to tune its description. The checker proves a skill is well-formed, not that it helps; only running it on real requests shows that.

Scale the effort to the skill. A small, low-risk skill needs a couple of realistic tries. A skill that many people will use, that changes files or external systems, or that keeps going wrong deserves the full loop below. Skills with objectively checkable output (a file transform, generated code, a fixed workflow) benefit most from written expectations; for subjective output (writing style, design), rely on a person's review instead of forcing pass/fail checks.

## Contents

1. Where evals live
2. Task evals: does the skill help?
3. Grading
4. Improving the skill
5. Trigger tests: does the description pick the skill?
6. Without subagents

## 1. Where evals live

Keep evals outside the skill folder, so installers (`npx skills`, plugins) don't ship them and agents don't load them:

| Layout                       | Evals folder              |
| ---------------------------- | ------------------------- |
| project (`.agents/skills/`)  | `.agents/evals/<name>/`   |
| catalog (`skills/`)          | `evals/<name>/`           |

- `evals.json`: task evals. `check-skills.mjs` validates it.

  ```json
  {
    "skill_name": "<name>",
    "evals": [
      {
        "id": 1,
        "prompt": "A request a real user would type, with real detail",
        "expected_output": "What a good result looks like, in a sentence or two",
        "files": ["files/input.csv"],
        "expectations": ["The output CSV has a margin column", "The script in scripts/ was used"]
      }
    ]
  }
  ```

  `files` are inputs, relative to the evals folder. `expectations` are optional at first; add them while the first runs are going.
- `triggers.json`: description tests, a list of `{ "query": "…", "should_trigger": true }` (section 5).
- Run outputs do **not** go in the repo. Use a scratch workspace, for example `<tmp>/<name>-workspace/iteration-<N>/<eval-name>/<config>/`, where `<config>` is `with_skill`, `without_skill` or `old_skill`.

## 2. Task evals: does the skill help?

1. **Write two or three realistic prompts** (more later): the kind of thing a user would actually say, with file names, context and the odd typo. Include an edge case. Show them to the user and ask if they look right before running them.
2. **Snapshot first when improving an existing skill:** copy the skill folder to the workspace (`skill-snapshot/`) before editing, so there is an old version to compare against.
3. **Run each prompt twice, at the same time, in fresh subagents** (where the agent supports them):
   - **with the skill:** give the skill's path, the prompt, the input files and where to save outputs;
   - **a baseline:** the same prompt with no skill (new skill) or with the snapshot (improved skill).

   Give each run only what a real user would provide. Do not pass your diagnosis, the expected answer or the fix you have in mind; that tests your hint, not the skill. Keep generated files in the workspace and away from the working tree. Ask before a run would touch a live system, cost real money or take a long time.
4. **Record cost as runs finish.** If the agent reports tokens and duration when a subagent completes, save them at once as `timing.json` (`{ "total_tokens": …, "duration_ms": … }`) next to the outputs. That report is often the only place the numbers appear.
5. **Draft expectations while the runs go.** Good expectations are objectively checkable and named so a reader understands them at a glance ("the chart has labelled axes", not "chart OK"). Check anything a script can check with a script.
6. **Grade each run** (section 3), then summarize the iteration:

   ```bash
   node <skill-dir>/scripts/summarize-evals.mjs <workspace>/iteration-<N>
   ```

   It prints pass rate, tokens and time for each configuration (mean ± standard deviation), a per-eval table, the difference between `with_skill` and the baseline, and notes: expectations that pass in every configuration (they don't measure the skill), expectations that always fail (check the expectation too), and evals whose repeated runs disagree (flaky). Add `--json` for machine-readable output.
7. **Look for patterns the averages hide** before drawing conclusions:
   - **Expectations that don't measure the skill:** they pass in every configuration, including the baseline, so they say nothing about whether the skill helps. Replace them with ones that only a correct use of the skill would pass.
   - **Better but costlier:** a higher pass rate that comes with much more time or tokens may not be worth it. Report both, and look in the transcripts for the steps that cost the most.
   - **Wins and losses that cancel out:** compare per eval, not just the totals. A skill that fixes two cases and breaks one needs a look at the broken one.
   - **High spread:** a large standard deviation, or an eval whose runs disagree, means the result is luck. Run it more times or make the instruction behind it clearer before you tune on it.
   - **Errors and timeouts:** a run that failed for an outside reason (rate limit, missing tool) is not a skill failure. Exclude it and rerun.
8. **Show the user the outputs, not just the numbers.** Put each prompt next to what each version produced and ask what they would change. No comment on a case means it was fine.

## 3. Grading

Grade in a separate subagent where possible, so the grader has not seen the skill's intent. Give it the expectations, the run's transcript (if saved) and its output files, using the ready-made prompt in [grader-prompt.md](grader-prompt.md) so every run is graded the same way. Rules for the grader:

- **Pass only with evidence.** Quote the transcript or the output that shows it. If it can't be verified, it fails.
- **Substance, not surface.** A file with the right name and the wrong content fails. So does an output that meets the wording by accident.
- **No partial credit.** Each expectation passes or fails.
- **Check claims.** If the output says "all tests pass" or "validated", verify it from the transcript or by running the check.
- **Critique the evals** too: report expectations that a clearly wrong output would also pass, and important outcomes (good or bad) that no expectation covers.

Write `grading.json` next to each run's outputs:

```json
{
  "expectations": [
    { "text": "The output CSV has a margin column", "passed": true, "evidence": "Column F 'margin' in out.csv" }
  ]
}
```

These field names (`text`, `passed`, `evidence`) also match Anthropic's `skill-creator` tooling. For a strict "is the new version actually better?" question, give a grader both outputs labelled A and B without saying which is which, and ask it to choose and explain.

## 4. Improving the skill

- **Generalize from the feedback.** You are tuning on a handful of examples for a skill that will see thousands of different requests. Fix the cause behind a complaint rather than adding a rule for that one case. If a fix doesn't take, try a different explanation or approach instead of a stronger MUST.
- **Read the transcripts, not just the results.** If the agent wasted steps, find the instruction that sent it there and cut or reword it.
- **Bundle repeated work.** If every run wrote a similar helper, put one tested script in `scripts/` and tell the skill to use it.
- **Keep it lean.** Remove what isn't pulling its weight; every line is paid for in every session.
- **Prefer a narrow correction** to a new universal rule, and keep the skill's `name`, folder and invocation policy unless the user asks to change them.

Then rerun every eval into `iteration-<N+1>/` with a baseline, summarize, and review with the user again. Stop when the user is happy, the feedback is empty, or changes stop making a difference. Once the skill is stable, add more prompts, especially ones unlike those you tuned on.

## 5. Trigger tests: does the description pick the skill?

Tune the description once the skill itself works.

1. **Write about 20 queries** in `triggers.json`, roughly half `should_trigger: true` and half `false`. Make them realistic and specific, with paths, names and context, of varied length and tone.
   - **Should trigger:** different phrasings of the same need, requests that don't name the skill or its file type but clearly need it, less common uses, and requests where this skill competes with another and should win.
   - **Should not trigger:** near misses that share words or ideas with the skill but need something else. Obviously unrelated queries ("write a fibonacci function") test nothing.
   - Skip trivial one-step requests; agents answer those without any skill.
2. **Review the list with the user**, because a bad query set tunes the description in the wrong direction.
3. **Hold some back.** Set aside about a third of the queries and tune only on the rest. Judge each new description on the held-back ones too, so it is not overfitted to the queries you looked at.
4. **Measure.**
   - **In Claude Code (or anywhere the `claude` CLI is logged in),** run the queries against the real tool:

     ```bash
     node <skill-dir>/scripts/run-triggers.mjs <skill-folder> --triggers <evals-folder>/triggers.json \
       [--description "<candidate>"] [--model <model>] [--neighbours <skills-folder>]
     ```

     It runs each query 3 times (`--runs`) in a fresh `claude -p`, in a throwaway project holding a copy of the skill and links to your other user-level skills, and stops at the model's first tool call. User settings are turned off for these runs, so an installed copy of the same skill can't answer in its place; a plugin copy still can, and the report says so. It reports, for the tuning and held-back queries separately (`--holdout`, a third by default, always the same third), how many were right, precision (it loaded only when it should) and recall (it loaded whenever it should), then each query's hit rate and any other skill that was picked instead. `--description` tests a candidate without editing `SKILL.md`. `--neighbours` adds a folder of competing skills (for a catalog, its `skills/` folder); your installed user-level skills are always present, as in real use. `--json` gives machine-readable output.
   - **Use the model people use.** Which skill gets picked depends on the model, so pass the model your users run (`--model`). Without it, the runner uses the `model` in `~/.claude/settings.json`, or the CLI's default.
   - **The name counts too.** The model sees the skill's name as well as its description, so a clear name can carry queries a weak description misses. Tune the description with the real name in place, as the runner does.
   - **Cost:** each run is one short model turn, so 20 queries × 3 runs is 60 calls. Start with `--runs 1` while the queries are still changing.
   - **In other agents (Codex),** ask a fresh subagent for each query: "Here are the available skills, as name and description. Which one, if any, would you load for this request?" Give it this skill and its realistic neighbours. Run each query a few times, because the answer varies. This only approximates the real choice; confirm a few queries in the real tool.
5. **Revise and repeat** a few times: read which queries were wrong and which skill was picked instead, change the description to fix the cause (not by listing the failing queries), and test each candidate with `--description`. Keep the version that scores best on the held-back queries. Show the user the old and new descriptions with the scores. If `agents/openai.yaml` text no longer matches, update it.

## 6. Without subagents

If the agent can't start independent subagents, run each prompt yourself by reading the skill and following it, one prompt at a time. This is weaker, because you already know what the skill is meant to do, so skip the baselines and the numbers and lean on the user's review of each output.
