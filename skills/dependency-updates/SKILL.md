---
name: dependency-updates
description: "Set up automated dependency update checks for a GitHub repository: a .github/dependabot.yml for every package ecosystem the repo uses, plus a scheduled workflow and a no-dependency Node script that check the runtimes and CLIs Dependabot can't read (mise.toml, .tool-versions, .nvmrc, .python-version, package.json engines) against the newest LTS or release and keep one issue open while anything is behind. Use when asked to add Dependabot, keep dependencies or Node/Python/CLI versions up to date, check for outdated packages or runtimes, replace Renovate, or when a new or existing repository has no dependency update setup, even if the user doesn't mention Dependabot."
---

# Dependency updates

Two parts, both using only what GitHub provides (no third-party app or account):

1. **Dependabot** (`.github/dependabot.yml`) opens update PRs for package manifests and GitHub Actions.
2. **A version check** (`scripts/check-versions.mjs`, `.github/version-check.json`, `.github/workflows/version-check.yml`) covers what Dependabot can't read: runtime and CLI pins in `mise.toml`, `.tool-versions`, `.nvmrc`, `.python-version` and `package.json` `engines`. Every Monday it compares them with the newest LTS or release and keeps a single "Outdated versions" issue open while anything needs attention. It closes the issue when everything is current. Runtime upgrades get an issue rather than a PR, because they usually need a person to look at them.

Use only the parts the repository needs. A repo with no runtime pins needs only Dependabot. A repo that already has Renovate or Dependabot gets the gaps filled, not a second tool doing the same job.

## Steps

1. **Read the repo's own rules first** (`AGENTS.md`, `CONTRIBUTING.md`): branch, commit, PR and version-lookup rules there win over this skill.
2. **Inventory what to update.** List the manifests and lockfiles (`package.json`, `pnpm-lock.yaml`, `requirements*.txt`, `pyproject.toml`, `uv.lock`, `go.mod`, `Cargo.toml`, `Gemfile`, `Dockerfile`, `compose*.yml`, `*.tf`, `.pre-commit-config.yaml`, `.devcontainer/`, `.github/workflows/`), with every directory they are in (monorepos, `infra/`, `docs/`). Separately, list the runtime and CLI pins: `mise.toml`, `.tool-versions`, `.nvmrc`, `.node-version`, `.python-version`, `engines`, `@types/node`, `FROM` lines that follow a runtime.
3. **Write `.github/dependabot.yml`.** Start from [assets/dependabot.yml](assets/dependabot.yml). Add one `updates` entry per ecosystem, with `directories` listing every folder that has that manifest. Read [references/dependabot.md](references/dependabot.md) for the ecosystem names, grouping, `ignore` and the gotchas. Each `ignore` entry needs a comment that says why and the date it was checked, so someone can later tell when to remove it.
4. **Add the version check if step 2 found pins.**
   - Copy [scripts/check-versions.mjs](scripts/check-versions.mjs) to `scripts/check-versions.mjs` in the repo, unchanged, so it can be refreshed from this skill later.
   - Write `.github/version-check.json` from [assets/version-check.json](assets/version-check.json). Add one check per runtime or CLI, listing every file that pins the version the project runs on (the config format is below). List `engines` only when it pins that version (`"24"`, `"24.x"`, `">=24 <25"`). A `>=` support floor such as `">=20"` says which versions still work, not which one to run, so leave it out: it counts as current while the latest version satisfies it, and moving it is a support decision, not an update.
   - Copy [assets/version-check.yml](assets/version-check.yml) to `.github/workflows/version-check.yml`. If the repo pins the latest action version some other way (by full SHA, or a newer major), follow the repo.
   - Exclude whatever the check owns from Dependabot, to avoid two sources of truth. For example, ignore `@types/node` majors, which follow the Node.js major.
5. **Verify** before you commit:
   - From the repo root, run `node scripts/check-versions.mjs` (set `GITHUB_TOKEN`, e.g. `GITHUB_TOKEN=$(gh auth token)`, if any check uses `github-release`). It must exit 0 or 1, and every row must show a real value: a `missing` row means the pin's path or key is wrong.
   - Run `actionlint` on the workflow if it is installed.
   - Check the YAML against [references/dependabot.md](references/dependabot.md). Dependabot reports config errors only after the file is on the default branch, under Insights → Dependency graph → Dependabot.
6. **Document it** where the repo lists its tooling (`AGENTS.md` or `README.md`). Say what Dependabot covers, what the version check covers, and why each `ignore` entry exists.
7. **Hand off.** Commit, push and open a PR only as the user and repo rules allow. Once it is merged, offer to run the workflow once with `gh workflow run version-check.yml`. That run will open the issue if something is already behind, which is posting to GitHub, so ask first. Upgrading what it reports is a separate task.

## Version check config

`.github/version-check.json` has a `checks` array. Each check has:

- `name`, unique, shown in the report;
- `latest.source`, one of:
  - `node-lts`: the newest Node.js LTS, from `nodejs.org/dist/index.json`;
  - `github-release` with `repo` (`"pulumi/pulumi"`): that repo's latest release tag;
  - `npm` with `package`: the `latest` dist-tag;
  - `pypi` with `package`: the newest release on PyPI;
- `match`: `major` (default), `minor` or `exact`, the part of the version that must equal the latest;
- `pins`: one entry per file. Each has `file` (relative to the repo root) and at most one of:
  - `mise` (a tool key in `mise.toml`; `"npm:@scope/cli"` and `{ version = "…" }` work);
  - `tool` (a tool in `.tool-versions`);
  - `json` (a key path, e.g. `["engines", "node"]`);
  - `regex` (the first capture group, e.g. `"^FROM node:(\\d+)"`).

  With none of them, the whole file is the value (`.nvmrc`). Add `label` to rename the row. `file`, `mise`, `tool`, `regex` and `label` are strings and `json` is an array of strings; the script exits 2 on anything else.

A pinned range is compared by its first number, so `">=24 <25"` counts as 24. A support floor with no upper bound (`">=20"`) is never `behind`: it is `current` while the latest version satisfies it, and `ahead` if it is above the latest.

Each row's status is one of:

- `current`;
- `behind`;
- `ahead`: a newer, non-LTS version;
- `missing`: the file or key isn't there, which usually means a bad path;
- `floating`: a value with no number, like `lts` or `latest`.

`current` and `floating` count as fine. The others keep the issue open.

For a runtime with no source above (Python itself, Go, Terraform), use `github-release` when the project publishes GitHub releases. Otherwise, add a source to `SOURCES` in the script: it is a URL plus a function that picks the version from the JSON. Add a test next to it.

## Gotchas

- **Dependabot doesn't read `mise.toml`, `.tool-versions`, `.nvmrc`, `.python-version` or `engines`** (checked 2026-11-16). That is the whole reason for the version check. Check the supported list in [references/dependabot.md](references/dependabot.md) again before relying on this.
- **Find each latest version from its source, not from memory**, both when writing pins and when judging the report. Model memory is often a major version behind.
- **The newest Node.js release is often not LTS.** A newer "Current" release is not LTS. That is why the check reads the `lts` field of each release instead of taking the highest version.
- **A failed lookup exits 2 and leaves the issue alone.** Never let a network error close the issue as if everything were current.
- **The issue lookup filters by author `app/github-actions` and an exact title**, so a person's issue with a similar title isn't edited. Changing `TITLE` orphans the old issue.
- **Dependabot PRs run CI with Dependabot's own secrets, not the repo's Actions secrets.** Steps that need secrets (deploys, previews) fail or skip on them unless those secrets are added under Dependabot secrets.
- **Grouping keeps PR noise down.** One group for minor and patch updates, plus groups for packages that must move together (`@astrojs/*`, `@pulumi/*`). Leave majors as separate PRs so each gets a review.
