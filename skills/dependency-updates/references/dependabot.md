# Dependabot reference

Read this when writing or checking `.github/dependabot.yml`. Sources, checked 2026-11-16: GitHub Docs [Supported ecosystems and repositories](https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories) and [Dependabot options reference](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference). Re-check them before relying on a detail that may have changed.

## `package-ecosystem` values

| Value | Covers |
| --- | --- |
| `npm` | npm, pnpm and Yarn |
| `bun` | Bun (1.1.39 and later) |
| `deno` | Deno 2 and later |
| `pip` | pip, pipenv, pip-compile and Poetry |
| `uv` | uv |
| `conda` | Conda |
| `gomod` | Go modules |
| `cargo` | Cargo |
| `rust-toolchain` | `rust-toolchain` files |
| `bundler` | Bundler |
| `composer` | Composer |
| `maven`, `gradle`, `sbt` | JVM builds |
| `nuget`, `dotnet-sdk` | .NET packages and `global.json` SDK |
| `mix` | Hex |
| `pub`, `swift`, `elm`, `vcpkg`, `nix`, `bazel` | as named |
| `docker` | `Dockerfile` base images |
| `docker-compose` | images in Compose v2 and v3 files |
| `helm` | Helm 3 charts |
| `terraform`, `opentofu` | providers and modules |
| `pre-commit` | `.pre-commit-config.yaml` hooks |
| `devcontainers` | dev container features |
| `gitsubmodule` | git submodules |
| `github-actions` | actions in `.github/workflows/` (use `directory: /`) |

Not covered (so the version check handles them): `mise.toml`, `.tool-versions`, `.nvmrc` / `.node-version`, `.python-version` and `package.json` `engines`.

## Options that matter

- **`directory` vs `directories`:** `directory` takes one path with no globs. `directories` takes a list and accepts globs (`/apps/*`). For `github-actions` and `devcontainers` use `/`. Two entries for the same ecosystem and branch must not cover the same directory.
- **`schedule`:**
  - `interval` is `daily` (weekdays), `weekly`, `monthly` or `cron`; `quarterly`, `semiannually` and `yearly` also exist, but only on GitHub Enterprise Server 3.19 and later.
  - `day` (for weekly) is `monday` to `sunday`.
  - `time` is `"hh:mm"`, quoted so YAML doesn't read it as a number.
  - `timezone` is an IANA name and defaults to UTC.
  - `cronjob` holds a five-field expression when `interval: cron`; put the timezone in `timezone`, not in `cronjob`.
- **`groups`:**
  - each `<name>` (starts and ends with a letter) takes `patterns` and `exclude-patterns` (`*` wildcards), `update-types` (`patch`, `minor`, `major`), `dependency-type` (`development` or `production`; npm, pip, bundler, composer, maven and mix only) and `applies-to` (`version-updates`, the default, or `security-updates`);
  - a dependency goes into the first group it matches.
- **`ignore`:**
  - `dependency-name` accepts `*`;
  - `versions` uses the package manager's range syntax (`['>=7']` for npm);
  - `update-types` takes `version-update:semver-major`, `-minor` and `-patch`.
- **`commit-message.prefix`:** up to 50 characters. Dependabot adds the colon when the prefix ends in a letter, digit, `)` or `]`, so write `chore(deps)`, not `chore(deps):`. `include: scope` appends `deps` or `deps-dev`.
- **`cooldown`:** delays version updates for new releases. The default is 3 days, and it doesn't apply to security updates. Keys are `default-days`, `semver-major-days`, `semver-minor-days`, `semver-patch-days`, `include` and `exclude`.
- **`open-pull-requests-limit`:** the default is 5 open version-update PRs per entry, and `0` pauses version updates. Security updates have their own fixed limit of 10.
- **`multi-ecosystem-groups`:** put updates from several ecosystems into one PR. Use them only when they really ship together.

## Practical notes

- Turn on Dependabot alerts and security updates in the repository settings as well. `dependabot.yml` controls version updates only. Changing repository settings is the user's call.
- Dependabot PR titles come from Dependabot. If the repo requires a format (Conventional Commits, a branch suffix), the `commit-message.prefix` covers the first part. Agree with the user on whether to accept the rest as it is.
- A grouped PR that fails CI blocks every update in it. Split out the package that fails (another group, or an `ignore` with a dated reason) rather than leaving the group stuck.
