# Setup and operational diagnosis

Use the official sources listed in [sources.md](sources.md), plus the installed CLI's help. These are procedures to apply within the user's authorization, not instructions to change this host merely by loading the skill.

## Tools and configuration

- Check for native ARM64 Colima and its dependencies, especially Lima and a Docker client. Colima provides the VM and runtime; a host Docker CLI, Compose and buildx may need separate installation. Inspect executable resolution with `command -v` and follow through shims before using `file` to diagnose architecture.
- Follow the project's package manager policy. Where mise is used, check `mise registry` and current upstream installation guidance before proposing `mise use -g colima@latest`. Do not assume installing the Colima binary installed Lima, Docker plugins or QEMU. Avoid mixing Intel and ARM tool installations.
- Check versions against official releases before installing or upgrading. Do not freeze a guessed latest version into instructions, run a development build by default, or replace an existing setup without need.
- `${COLIMA_HOME:-$HOME/.colima}/PROFILE/colima.yaml` is the usual per-profile config. Inspect any template or overrides if effective settings differ from expectations. `colima template` changes defaults for future profiles; it is not a targeted edit of the current one.
- Use local help for resource and mount flags. A CLI start can persist configuration, so it is not a read-only way to preview settings. Inspect config first, then explain the restart or replacement required by the proposed change. Disk growth is not a way to shrink a disk.

## Diagnose by layer

| Symptom                     | First checks and next action                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot connect to daemon    | Profile status, inspected context endpoint, client environment overrides and `docker --context CONTEXT info`; avoid socket symlinks as a first fix                                                        |
| Broken profile after reboot | Preserve status/error output; inspect startup diagnostics. Upstream suggests a forced stop followed by start, but explain interruption and obtain approval before forcing it                              |
| Empty bind mount            | Verify the exact host directory exists and is included in the profile's mounts, then verify the container mount; avoid mounting the entire home directory to fix one path                                 |
| File watcher misses changes | Confirm shared-mount behavior; try project-scoped polling (for example `CHOKIDAR_USEPOLLING=true` for tools that support it). Explain its CPU cost; check version support before suggesting mount-inotify |
| DNS or network failure      | Separate host DNS, VM connectivity, container DNS and registry authentication failures; avoid replacing DNS globally or adding insecure registries blindly                                                |
| Out of space or memory      | Inspect host free space, profile limits and Docker usage on the selected daemon; propose resource changes before destructive cleanup                                                                      |
| Slow AMD64 workload         | Verify it actually needs AMD64 and which translator is active; use a native ARM64 image when compatible or consult the AMD64 testing reference                                                            |

Request additional diagnostic commands only as needed. A verbose `colima start` actually starts or changes a VM; `colima ssh` executes in the guest and may require separate permission under project rules. Redact sensitive paths, environment values and registry information before sharing logs.

## Automation

Inspect the specific profile before starting. Distinguish an absent or normally stopped profile from a Broken one or an unexpected CLI failure. Start only a known compatible profile, or deliberately create an unused name. Check readiness on its verified Docker context with bounded retries and return a non-zero failure with the last diagnostic on timeout.

Keep context and socket selection local to each process. Avoid global context switches, unconditional restarts and implicit default-profile selection. Do not stop a pre-existing VM in an exit trap: track whether this operation created or started it, and respect other users of that profile. Leave profile deletion as an explicit, separately authorized action.

For a Docker runtime, change daemon settings through the profile's `docker:` configuration rather than assuming the macOS client's `~/.docker/daemon.json` controls the Linux daemon. Preserve existing settings. Changes to containerd, Kubernetes, Incus or GPU backends require their own runtime-specific investigation; do not recreate a Docker profile to switch runtimes as a shortcut.
