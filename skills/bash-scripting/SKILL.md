---
name: bash-scripting
description: "Write, refactor or review Bash/shell scripts as small, single-purpose, reusable functions with a main entry point, then validate and format them with bash -n, ShellCheck and shfmt. Use when asked to write, create, fix, clean up or lint a .sh or bash script, even if the user doesn't mention ShellCheck or shfmt."
---

# Bash Scripting

Write Bash that is modular, readable and checked. Start from [assets/script-template.sh](assets/script-template.sh) for a new script.

## Write

1. **Check the target shell and repo rules first.** Read the repo's `AGENTS.md` and `.editorconfig`. Scripts that must run on stock macOS stay on bash 3.2: no associative arrays, `mapfile`, `${var,,}` or `declare -n`. If the target is POSIX `sh`, use `#!/bin/sh` and no bashisms.
2. **Shape the script as functions plus `main`.**
   - Each function does one thing and has a verb name (`parse_args`, `require_cmd`, `read_config`). Aim for under about 20 lines; split when it grows.
   - Function bodies hold no top-level logic: the file ends with `main "$@"`, guarded by `[[ "${BASH_SOURCE[0]}" == "$0" ]]` so tests can `source` it without running it.
   - Generic helpers (`log`, `die`, `require_cmd`) are the reusable part. Reuse the repo's existing helper library if it has one instead of redefining them.
   - Pass data through arguments and stdout, not globals. Declare function variables with `local`; use `readonly` for constants.
3. **Be defensive.** `set -euo pipefail` after the shebang (`#!/usr/bin/env bash`). Quote every expansion (`"${var}"`). Use `[[ ]]` over `[ ]`, `$(...)` over backticks, `printf` over `echo` for anything with data. Send errors to stderr and exit non-zero. Check required commands up front. Never `eval` input or build commands from strings: use arrays.
4. **Comment why, not what.** A header line saying what the script does and its usage; a comment only where the reason is not obvious.

## Validate and format (always, before reporting done)

Run the bundled validator on every script you wrote or changed:

```bash
bash <skill-dir>/scripts/validate-bash.sh path/to/script.sh   # format in place, then check
bash <skill-dir>/scripts/validate-bash.sh --check path/to/script.sh   # report only, change nothing
```

It runs, in order, `bash -n` (syntax), `shellcheck -x`, and `shfmt` (which reads `.editorconfig`, so the repo's indent style wins; with none it uses tabs). Exit code `0` is clean, `1` means a check failed, `2` means a tool is missing.

- **Missing tool (exit 2):** do not skip the check. Tell the user which tool is missing and suggest the install command the script prints (`mise use -g shellcheck shfmt`, or `brew install shellcheck shfmt`). Prefer mise if the repo or workspace uses it. Install only if the user agrees. If they decline, say plainly that the script was not checked.
- **Failures:** fix the code and re-run until it passes. Fix the cause of a ShellCheck finding rather than silencing it; use `# shellcheck disable=SCxxxx` only for a true false positive, with a one-line reason on the line above.
- **Report** the result: which checks passed, and anything left unchecked.
- shfmt rewrites the file, so run it before showing a final diff, and tell the user if it reformatted code they wrote.
