---
name: colima-macos-arm64
description: "Set up, operate and troubleshoot Colima on macOS ARM64 (Apple Silicon), including Docker profiles and contexts, VZ with Rosetta for Linux AMD64 containers, QEMU comparisons, mounts and startup failures. Use when Colima backs local containers, an AMD64 binary crashes under emulation, Docker cannot reach a Colima socket, or automation must target the right Colima profile. Excludes Docker Desktop, other container backends and native Linux host administration."
---

# Colima on Apple Silicon

## Inspect before changing anything

1. Read the project's agent instructions. Confirm the requested profile and whether existing workloads may be interrupted. Creating this skill or asking for advice does not authorize changing a VM.
2. Check `uname -m`, `sw_vers -productVersion`, `command -v colima`, `command -v docker`, `colima version`, `colima list` and `colima start --help`. This workflow targets Apple Silicon (`arm64`); check for a translated terminal or x86 executable if the host reports `x86_64`. Consult current official docs for the installed version rather than assuming upstream `main` matches it.
3. Inspect `docker context ls`, `docker context show`, and the selected context with `docker context inspect CONTEXT`. Check whether `COLIMA_HOME`, `COLIMA_PROFILE`, `DOCKER_CONTEXT` or `DOCKER_HOST` overrides the intended target; do not dump the full environment or Docker credential files.
4. Inspect the chosen profile with `colima --profile PROFILE status`. Configuration normally lives at `${COLIMA_HOME:-$HOME/.colima}/PROFILE/colima.yaml`. Read relevant settings: `arch`, `runtime`, `vmType`, `rosetta`, `binfmt`, mounts and resource limits. A failed status call is diagnostic evidence, not a reason to recreate the VM.
5. Account for the diagnostic process's permissions. In an agent sandbox, `Operation not permitted`, socket access failures, or even `Broken` / `not running` output may reflect restricted host access. Before diagnosing a VM failure or proposing recovery, follow the read-only comparison in [references/operations.md](references/operations.md#separate-access-failures-from-vm-state). If a reliable check is unavailable, report the profile state as unknown because access is restricted.

For setup, missing tools or installation architecture problems, read [references/operations.md](references/operations.md). Sources and the date they were checked are in [references/sources.md](references/sources.md); refresh relevant sources before making version-sensitive recommendations.

## Choose the execution mode

| Need                                   | VM and container choice                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| Ordinary local development             | Native `aarch64` VM, VZ, ARM64 container images                                              |
| Linux AMD64 userspace on Apple Silicon | `aarch64` VZ VM with Rosetta; preserve the original container image platform for comparisons |
| Compare translation engines            | Separate ARM64 profile with Rosetta disabled and binfmt enabled for QEMU user emulation      |
| An actual x86 Linux guest/kernel       | Separate `x86_64` QEMU VM; expect substantially slower execution                             |
| Release confidence on AMD64 hardware   | Test the exact artifact on native Linux AMD64 as well                                        |

Rosetta translates Linux AMD64 processes inside an ARM64 VM. It does not provide an x86 kernel. VZ with Rosetta requires Apple Silicon and macOS 13 or newer; verify current version support. `--platform linux/amd64` selects the image architecture, not the translator. `uname -m` inside a container alone does not prove Rosetta was used.

For an authorized new Rosetta test profile, first verify that the name is unused with `colima list`. The following is an example, not permission to run it:

```sh
colima start amd64-test --runtime docker --arch aarch64 --vm-type vz --vz-rosetta --activate=false
```

Use `--activate=false` to avoid changing the user's active context. If that profile already exists, inspect it before starting: architecture, VM type and runtime cannot simply be changed by repeating creation flags. Prefer a new, clearly named profile over deleting existing data. With Rosetta enabled, current Colima treats `--binfmt` as a no-op; check local help before choosing a comparison configuration.

## Target and verify the intended daemon

Discover the profile's context from `docker context ls` and inspect its endpoint. The default profile normally uses `colima`, named profiles `colima-PROFILE`; verify rather than constructing a name blindly. Run commands with an explicit `--context` to avoid a global context switch:

```sh
docker --context CONTEXT info
docker --context CONTEXT ps
```

Use `docker info` as the readiness check, with bounded retries in automation; a VM being running does not guarantee the daemon is ready. Stop and show the last error on timeout. Do not treat an arbitrary failed `colima status` as permission to start or repair a profile.

For SDKs that require `DOCKER_HOST`, discover the Unix socket with `colima status` or context inspection. Pass it only to the relevant process and account for conflicting `DOCKER_CONTEXT`. Do not overwrite `/var/run/docker.sock`, export a guessed default socket globally, or expose an unauthenticated TCP daemon to fix a local client connection.

For an authorized container smoke test, use a trusted image and an explicit image platform. The image and candidate binary can have different architectures; preserve the original image platform and digest when comparing translators. Pulling an image requires network access. Do not silently change global `DOCKER_DEFAULT_PLATFORM` or buildx settings. Inspect a buildx builder's endpoint separately if builds reach a different daemon.

## Investigate emulation failures

Read [references/amd64-testing.md](references/amd64-testing.md) when an AMD64 binary crashes, a release needs verification, or a Rosetta/QEMU comparison is requested. Preserve the exact binary, checksum, image, arguments and environment across runs. Record the host, guest, container architecture and actual translation configuration separately.

Keep a native ARM64 result, an emulated AMD64 result and a native AMD64 result distinct. A pass with `GOGC=off`, reduced concurrency or other runtime changes is a diagnostic experiment; it cannot replace a pass with normal settings. An upstream emulator issue is supporting evidence, not proof that it caused this crash.

## Recover without losing data

For Broken status, sockets, mount visibility, file watchers, DNS, resources or startup automation, read [references/operations.md](references/operations.md). Diagnose the smallest failing layer before changing configuration.

Explain interruption and obtain approval before forced stops, profile deletion, pruning, volume removal or VM recreation. Do not automate `colima delete`, `docker system prune` or `docker compose down -v` as recovery. Verify the selected profile and daemon immediately before any destructive command, and explain which data is at risk for that installed version. A new Colima profile is not a security sandbox for untrusted workloads.

## Report the outcome

State the profile and verified endpoint, execution mode, changes made, commands actually tested and results. Distinguish proposed commands from executed commands and explain any remaining uncertainty. Report profiles or containers left running; do not delete them as implicit cleanup.
