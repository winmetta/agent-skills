# Review rubric

Review the change the PR makes, not the code it leaves alone. Every finding must be something the author should act on before merging; the author has to resolve each one, so noise costs them real time.

## Look for

1. **Correctness:** logic errors, wrong conditions, off-by-one, unhandled `null`/error paths, race conditions, broken edge cases (empty input, large input, Unicode, time zones).
2. **Security and privacy:** injection, missing authorization checks, secrets or personal data in code, logs or URLs, unsafe deserialization, overly broad permissions.
3. **Contracts across code and repositories:** changed function signatures, API shapes, config keys, environment variables, database schemas or file formats whose other users (in this repository or the related ones you were given) were not updated.
4. **Data and migrations:** irreversible changes without a path back, migrations that lock or lose data, changed defaults.
5. **Tests:** new behaviour or a fixed bug with no test, or tests that would still pass if the code were wrong.
6. **The repository's own rules** in `AGENTS.md`, `CLAUDE.md` or `CONTRIBUTING.md`, when the change breaks one.

## Leave out

- Style, formatting and naming that a linter or formatter in the repository already checks.
- Preferences ("I would have…") with no concrete failure.
- Anything you have not checked in the code: read the surrounding code and the callers before reporting.
- Problems in code the PR does not touch, unless the PR makes them worse or newly reachable.

## Writing a finding

- **Severity:** `high` for bugs, security holes, data loss or broken contracts; `medium` for likely problems and missing tests; `low` for minor but real issues. If you would not block a merge on it and it is not a real improvement, drop it.
- **Title:** the problem in one line, not the fix ("Retries never stop when the token is revoked").
- **Body:** what is wrong, a concrete scenario where it fails (input, state, result), and how to fix it. Quote the minimum code needed.
- **Location:** `path` relative to the repository root, `line` in the PR's head version of the file (`side: RIGHT`), or in the base version for a deleted line (`side: LEFT`). Use `start_line` for a range. Point at the line that needs to change, which should be in the diff where possible; findings elsewhere are still posted, in the review summary.
- **Suggestion:** only when you know the exact replacement for those lines, complete and correctly indented.
- One finding per problem; merge duplicates. No findings is a valid result.
