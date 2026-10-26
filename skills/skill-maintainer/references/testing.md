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
7. **Show the user the outputs, not just the numbers.** Put each prompt next to what each version produced and ask what they would change. No comment on a case means it was fine.

## 3. Grading

Grade in a separate subagent where possible, so the grader has not seen the skill's intent. Give it the expectations, the run's transcript (if saved) and its output files. Rules for the grader:

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
4. **Measure.** For each query, ask a fresh subagent: "Here are the available skills, as name and description. Which one, if any, would you load for this request?" Give it this skill and its realistic neighbours (the other skills in the repo or installed). Run each query a few times, because the answer varies. This approximates the real choice; confirm the result in the real tool on a few queries. In Claude Code, Anthropic's `skill-creator` skill has scripts that run this loop against the real CLI (`claude -p`) and propose descriptions.
5. **Revise and repeat** a few times: read which queries were wrong, change the description to fix the cause (not by listing the failing queries), and keep the version that scores best on the held-back queries. Show the user the old and new descriptions with the scores. If `agents/openai.yaml` text no longer matches, update it.

## 6. Without subagents

If the agent can't start independent subagents, run each prompt yourself by reading the skill and following it, one prompt at a time. This is weaker, because you already know what the skill is meant to do, so skip the baselines and the numbers and lean on the user's review of each output.
