# Usage and help text

Read this when a script takes options or arguments, or gets a `-h, --help` flag. The layout follows the help that CLIs built on clap (Rust) print, such as `mise --help`: one shape for every script, so readers know where to look.

Sources: `mise --help` and `mise use --help` (mise 2026.10.19), the clap help template, and the GNU Coding Standards on `--help` (output to stdout, exit successfully). Checked 2026-11-16.

## Layout

```text
<One line: what the script does>

Usage: <name> [FLAGS] <ARG> [ARG]...

Commands:
  build    Build the site
  deploy   Upload the build [aliases: d]
  help     Print this message or the help of the given command

Arguments:
  <ARG>  What the first argument is
  [ARG]  An optional argument; describe the default when it is left out

Flags:
  -o, --output <FILE>  Write the result to FILE [default: out.txt]
  -n, --dry-run        Print what would change without changing it
  -v, --verbose        Print more detail [env: MYTOOL_VERBOSE]
      --no-color       Do not colour the output
  -h, --help           Print help

Examples:
    $ <name> input.txt

    $ <name> -o result.txt input.txt
```

Include only the sections the script has: no `Commands:` without subcommands, no `Arguments:` without positional arguments. Keep `Flags:` (there is always `-h, --help`) and `Examples:`.

## Rules

- **Order:** a one-line summary, an optional paragraph with more detail, then `Usage:`, `Commands:`, `Arguments:`, `Flags:` and `Examples:`, each separated by one blank line.
- **Headings** start in column 0 and end with a colon. Entries are indented 2 spaces.
- **One description column per section.** Pad every name to the longest name in that section plus 2 spaces, so the descriptions start in the same column. Sections are aligned on their own: `Commands:` and `Flags:` usually start their descriptions at different columns.
- **Short and long forms:** write `-o, --output <FILE>`. A long-only flag gets 4 extra spaces (`      --no-color`) so every `--` lines up under the one above.
- **Placeholders:** values in upper case in angle brackets (`<FILE>`, `<DIR>`, `<KEY=VALUE>`). In `Usage:` and `Arguments:`, `<ARG>` is required, `[ARG]` is optional, and `...` means it can repeat. In `Usage:`, `[FLAGS]` stands for all the flags.
- **Descriptions** start with a capital letter, use the imperative or a noun phrase, and have no full stop at the end. Put extra facts at the end in square brackets: `[default: …]`, `[env: VAR]`, `[aliases: …]`, `[possible values: a, b]`.
- **Wrap at 80 columns.** Continue a long description on the next line, indented to its section's description column.
- **Examples** are indented 4 spaces, each starting with the shell prompt `$ `, with a blank line between them. Show real commands a user can copy, from the simplest to the most specific. A comment above an example, if needed, is indented 4 spaces too.
- **Subcommands** each have the same layout for `<name> <command> --help`. The top-level `Commands:` list shows only the one-line summary of each.

## Behaviour

- `-h` and `--help` print the full help to **stdout** and exit `0`, so `<name> --help | less` works.
- A usage error (unknown flag, missing argument) prints one line saying what is wrong, then the `Usage:` line and a hint, to **stderr**, and exits `2`:

  ```text
  my-tool: error: unknown flag: --colour

  Usage: my-tool [FLAGS] <FILE>

  For more information, try '--help'.
  ```

- Accept `--flag VALUE` and `--flag=VALUE`, and stop parsing flags at `--`. `getopts` handles only short options, so parse with a `while`/`case` loop when the script has long ones (as [the template](../assets/script-template.sh) does).
- Write the help in a heredoc in `usage()`, aligned by hand. shfmt never changes text inside a heredoc, so the alignment survives formatting. Use spaces, not tabs, in the help text: tabs show at different widths in different terminals.
- Keep the help and the parser in step: every flag the parser accepts appears under `Flags:`, and every flag listed works.
