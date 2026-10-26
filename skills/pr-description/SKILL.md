---
name: pr-description
description: "Write or update a pull request or merge request title and description, on any hosting platform, with the sections Why?, Impact, Technical Impact, Changelog (Conventional Commits), What changed, Validation, Dev Test, References, Not included / follow-ups and Checklist. Use when asked to open a PR or MR, write, draft or update its description, or when a branch's scope changed and its PR text no longer matches."
---

# PR description

"PR" means any change request (pull request, merge request) on any platform. The description is plain Markdown, written so it still makes sense later, for example as a squash-merge commit.

## Body

These level-2 headings, in this order. **Why?, Changelog and Validation are always included**; add each other section only when it has something worth saying, so a small PR stays short. Skeleton: [assets/pr-body-template.md](assets/pr-body-template.md). Example: [references/example.md](references/example.md).

- **`## Why?`**: the problem, need or goal, and why now. Not the changes.
- **`## Impact`**: the non-technical effect, in plain language: who notices and how, cost, risk, rollout.
- **`## Technical Impact`**: effect on code, architecture, design, data, APIs and compatibility, performance, security, dependencies; trade-offs and alternatives considered.
- **`## Changelog`**: one `- type(scope): what changed, and why` bullet per meaningful change (Conventional Commits; `!` for breaking). Group by change, not by commit.
- **`## What changed`**: the detail behind the Changelog, grouped by area (files, modules, commands, config), inside a collapsed block so the description stays short:

  ```markdown
  <details>
  <summary>Changes by area</summary>

  **`area/`**
  - …

  </details>
  ```

  Leave a blank line after `<summary>` and before `</details>`, or the Markdown inside won't render.
- **`## Validation`**: automated checks run and their results: format, lint, type check, build, tests, CI.
- **`## Dev Test`**: manual or end-to-end steps performed, where, and what was observed. Include it whenever behaviour changed, even if only to say what wasn't tried.
- **`## References`**: issues, tickets, related PRs and repos, official docs, wiki or design pages, RCAs, findings.
- **`## Not included / follow-ups`**: what is deliberately out of scope, known limitations, and the next steps, with links to their issues or PRs if they exist.
- **`## Checklist`**: task-list items (`- [x]` / `- [ ]`) for the repo's merge criteria: its PR template's checklist if it has one, otherwise the title follows Conventional Commits and covers the whole PR, the description matches the final state, tests and docs are updated, breaking changes are marked, and nothing secret or private is included. Tick only what is true.

Rules:

- **Never invent results.** List only what was actually run (by you, CI or the user). Record gaps as unchecked items with a reason: `- [ ] Not run on Windows: no machine available`.
- **Leave out sections that don't apply** rather than writing "None.", except the three required ones: say briefly why nothing applies there ("Docs-only change; no checks apply."). Never leave a heading empty.
- **Size to the PR:** a one-line fix may need only the three required sections; a large or risky change usually needs all of them. Skip What changed when it would just repeat a short Changelog.
- **Don't repeat the Changelog** in the other sections.
- **Extra sections** (screenshots, deployment notes) go after Checklist.
- **Public repos:** no secrets, personal data, internal hostnames or private links.

**Title:** Conventional Commits, imperative, under about 70 characters, covering the whole PR: `feat(auth): add passkey sign-in`.

## Steps

1. **Find the PR and its base.** Identify the host from `git remote -v` and use a client, API or agent tool already set up for it; don't install one. If none is available, give the user the draft to paste. For an existing PR, read its title, body, base and linked issues; otherwise the base is the default branch.
2. **Read the whole change:** `git log <base>..HEAD`, `git diff <base>...HEAD`, linked issues and the conversation. The reason is rarely in the diff.
3. **Collect evidence** for Validation and Dev Test: commands run this session, CI or pipeline results, what the user reported. Run a missing check if it's quick and safe; otherwise record it as not run.
4. **Follow the repo's rules:** `AGENTS.md`, `CONTRIBUTING.md`, and any PR or MR template (in `.github/`, `.gitlab/` or similar). Merge a template's checklist into Checklist and put its other extra sections after it. If the repo mandates a different structure, ask the user which to use.
5. **Draft into a file**, not a shell argument, and check it:

   ```bash
   node <skill-dir>/scripts/check-pr-body.mjs <file> --title "<title>" [--types feat,fix,…]
   ```

   It checks structure, Changelog format and title, not content, so reread the draft. Pass `--require "Dev Test,Checklist"` (any section names) when the repo makes more sections mandatory. Any lowercase commit type passes; pass `--types` when the repo defines its own list.
6. **Publish** with the platform's tool, passing the body from the file or standard input. Only create or edit a PR when the user asked; otherwise show the draft. Read it back afterwards and share the link.

## Updating

- Describe the PR as it is now: rebuild the Changelog from the full diff, drop reverted changes, refresh Validation and Dev Test, and update the title if the scope changed.
- Keep what others added (links, reviewer notes, screenshots, ticked items), moved into the right section.
- Convert an older structure (Summary, What changed, Testing…) without losing information: a summary splits into Why? and Impact, testing into Validation and Dev Test, and an open What changed list moves into the collapsed block.
- Update it whenever the scope changes and before merging.
