---
name: pr-description
description: "Write or update a pull request or merge request title and description, on any hosting platform, with the sections Why?, Impact, Technical Impact, Changelog (Conventional Commits), Validation, Dev Test and References. Use when asked to open a PR or MR, write, draft or update its description, or when a branch's scope changed and its PR text no longer matches."
---

# PR description

"PR" means any change request (pull request, merge request) on any platform. The description is plain Markdown, written so it still makes sense later, for example as a squash-merge commit.

## Body

These level-2 headings, in this order. Skeleton: [assets/pr-body-template.md](assets/pr-body-template.md). Example: [references/example.md](references/example.md).

- **`## Why?`**: the problem, need or goal, and why now. Not the changes.
- **`## Impact`**: the non-technical effect, in plain language: who notices and how, cost, risk, rollout.
- **`## Technical Impact`**: effect on code, architecture, design, data, APIs and compatibility, performance, security, dependencies; trade-offs and alternatives considered.
- **`## Changelog`**: one `- type(scope): what changed, and why` bullet per meaningful change (Conventional Commits; `!` for breaking). Group by change, not by commit.
- **`## Validation`**: automated checks run and their results: format, lint, type check, build, tests, CI.
- **`## Dev Test`**: manual or end-to-end steps performed, where, and what was observed.
- **`## References`**: issues, tickets, related PRs and repos, official docs, wiki or design pages, RCAs, findings.

Rules:

- **Never invent results.** List only what was actually run (by you, CI or the user). Record gaps as unchecked items with a reason: `- [ ] Not run on Windows: no machine available`.
- **No empty or missing sections.** Write "None." or a one-line reason instead.
- **Don't repeat the Changelog** in the other sections.
- **Extra sections** (checklist, screenshots) go after References.
- **Public repos:** no secrets, personal data, internal hostnames or private links.

**Title:** Conventional Commits, imperative, under about 70 characters, covering the whole PR: `feat(auth): add passkey sign-in`.

## Steps

1. **Find the PR and its base.** Identify the host from `git remote -v` and use a client, API or agent tool already set up for it; don't install one. If none is available, give the user the draft to paste. For an existing PR, read its title, body, base and linked issues; otherwise the base is the default branch.
2. **Read the whole change:** `git log <base>..HEAD`, `git diff <base>...HEAD`, linked issues and the conversation. The reason is rarely in the diff.
3. **Collect evidence** for Validation and Dev Test: commands run this session, CI or pipeline results, what the user reported. Run a missing check if it's quick and safe; otherwise record it as not run.
4. **Follow the repo's rules:** `AGENTS.md`, `CONTRIBUTING.md`, and any PR or MR template (in `.github/`, `.gitlab/` or similar). Keep a template's extra items after References. If the repo mandates a different structure, ask the user which to use.
5. **Draft into a file**, not a shell argument, and check it:

   ```bash
   node <skill-dir>/scripts/check-pr-body.mjs <file> --title "<title>"
   ```

   It checks structure, Changelog format and title, not content, so reread the draft.
6. **Publish** with the platform's tool, passing the body from the file or standard input. Only create or edit a PR when the user asked; otherwise show the draft. Read it back afterwards and share the link.

## Updating

- Describe the PR as it is now: rebuild the Changelog from the full diff, drop reverted changes, refresh Validation and Dev Test, and update the title if the scope changed.
- Keep what others added (links, reviewer notes, screenshots, ticked items), moved into the right section.
- Convert an older structure (Summary, What changed, Testing…) without losing information.
- Update it whenever the scope changes and before merging.
