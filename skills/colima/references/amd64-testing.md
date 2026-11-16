# Testing Linux AMD64 on Apple Silicon

Use this when choosing between Rosetta and QEMU or investigating an emulated failure. Read the multi-architecture sources in [sources.md](sources.md) and local `colima start --help` first.

## Collect reproducible evidence

- Record the artifact checksum (`shasum -a 256 PATH` on macOS), build revision, toolchain and `file PATH` output. Verify that a Linux ELF artifact, rather than a macOS Mach-O binary, is being run.
- Record macOS and Colima versions, profile configuration, runtime, context endpoint, image digest, container platform, mounts, resource limits, command and exit status. Keep secrets out of the report.
- For a new test, choose a compatible userspace image; a missing dynamic loader or libc mismatch can look like a missing executable even when the file exists. Do not switch distributions between translator comparisons without recording that additional variable.
- Do not infer the translator solely from `binfmt: true`: Rosetta can use binary-format registration too, and Colima ignores its binfmt flag when Rosetta is enabled. Inspect configuration and startup diagnostics. If guest inspection is needed, follow the user's rules for commands over SSH, including `colima ssh`.

## Compare one variable at a time

1. Reproduce with ordinary application settings and capture output and exit status. Repeat a small, stated number of times if intermittent.
2. Compare an ARM64 build on a native ARM64 container, clearly labelling it as a different artifact.
3. Run the same AMD64 artifact and image under Rosetta in an ARM64 VZ VM. For a QEMU user-mode comparison, use another inspected ARM64 profile with `rosetta: false` and `binfmt: true`; verify the actual handler where authorized. Do not install privileged binfmt helpers to change an existing shared VM as a first step.
4. Use full-system QEMU only when an x86 guest/kernel is required or another controlled comparison is useful. This is different from running an AMD64 container in an ARM64 guest. Verify `--arch x86_64 --vm-type qemu` support and QEMU dependencies before proposing a new profile.
5. Test the identical AMD64 artifact on native Linux AMD64 when available. Creating cloud machines or running remote commands requires the applicable authorization; otherwise record the missing test.

Changing `GOGC`, allocator settings or concurrency can narrow a hypothesis. Record these as separate experiments and restore normal settings for acceptance. A translator-specific pass/fail difference suggests an environment dependency; it does not establish which component is defective. Native success also does not prove every possible execution path is correct.

## Minimal container pattern

Set `IMAGE_PLATFORM` to the original container image's platform (for example `linux/arm64` or `linux/amd64`), independently of the candidate binary's architecture. An AMD64 executable can run through the registered translator inside an ARM64 image when its userspace dependencies are satisfied. For a translator comparison, preserve the original platform and exact image digest; switching to an AMD64 image is a separate experiment. A multi-platform tag alone does not identify the same image across platform selections.

After substituting the verified context, original image platform, image pinned by digest and binary path, an authorized smoke test can follow this shape:

```sh
docker --context CONTEXT run --rm --platform IMAGE_PLATFORM --network none \
  --mount "type=bind,src=/absolute/candidate-dir,dst=/candidate,readonly" \
  IMAGE /candidate/program --version
```

Confirm the host directory is shared into the VM and the executable has the needed permissions. `--network none` isolates container networking after the image exists locally; an image pull still needs network access. Mount only the candidate directory, read-only when possible. A version check is a smoke test; run the application's meaningful checks as well.

Report each row separately: native ARM64, QEMU user-mode AMD64, Rosetta AMD64 and native AMD64. Mark unperformed runs as not tested. Keep unresolved crashes visible in any release recommendation.
