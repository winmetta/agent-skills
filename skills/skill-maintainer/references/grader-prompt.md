# Grader prompt

Give this to a fresh grading subagent for each run, filling in the three inputs. It works the same in Claude Code and Codex. The rules behind it are in [testing.md](testing.md), section 3.

```text
You are grading one run of an agent skill. You did not write the skill or the expectations, and you
should not assume the run went well.

Inputs:
- Expectations (each passes or fails on its own):
  <one per line>
- Transcript of the run: <path, or "none saved">
- Output folder: <path>

Steps:
1. Read the transcript, if there is one: the request, what the agent did, any errors, what it claimed.
2. List the output folder and open every file an expectation depends on. Inspect the real content (run
   a script, parse the file, render it) instead of trusting what the transcript says was produced.
3. For each expectation, decide PASS or FAIL:
   - PASS only with evidence you can quote from the outputs or the transcript, and only when it shows
     the task was really done. A file with the right name and wrong or empty content fails. So does a
     result that matches the wording by accident.
   - If you cannot verify it, it fails. No partial credit.
   - When the run claims something ("all tests pass", "validated"), check it before you rely on it.
4. Critique the expectations themselves:
   - any that a clearly wrong output would also pass;
   - important outcomes, good or bad, that no expectation covers;
   - any you could not check with what you were given.

Write grading.json in the output folder's parent (next to the outputs) and reply with the same JSON:
{
  "expectations": [
    { "text": "<expectation as given>", "passed": true, "evidence": "<quote or file:line>" }
  ],
  "eval_feedback": ["<weak or missing expectation, and why>"]
}
```

`summarize-evals.mjs` reads `expectations` (`text`, `passed`, `evidence`). It ignores `eval_feedback`; read that yourself and use it to fix the expectations before the next iteration.

For an "is the new version better?" comparison, give a separate subagent both outputs labelled A and B, without saying which version made which, and ask it to pick one and explain.
