#!/usr/bin/env bash
# Validate and format Bash scripts: bash -n, ShellCheck, then shfmt.
# Run with -h for usage. shfmt with no style flags reads .editorconfig, so the repo's own indent
# settings win.
set -euo pipefail

readonly SCRIPT_NAME="${0##*/}"

# Help layout: see references/usage-help.md in this skill.
usage() {
    cat <<USAGE
Validate and format Bash scripts with bash -n, ShellCheck and shfmt

By default shfmt rewrites each file in place, then all checks run. shfmt reads
.editorconfig, so the repository's indent settings win. Exits 0 when every file
is clean, 1 when a check fails, and 2 for a usage error or a missing tool.

Usage: ${SCRIPT_NAME} [FLAGS] <FILE>...

Arguments:
  <FILE>...  Bash scripts to check

Flags:
      --check  Report only: shfmt prints a diff and no file is changed
  -h, --help   Print help

Examples:
    \$ ${SCRIPT_NAME} script.sh

    \$ ${SCRIPT_NAME} --check scripts/*.sh
USAGE
}

# Report a usage error on stderr and exit 2.
usage_error() {
    log "${SCRIPT_NAME}: error: $*"
    log ""
    log "Usage: ${SCRIPT_NAME} [FLAGS] <FILE>..."
    log ""
    log "For more information, try '--help'."
    exit 2
}

log() { printf '%s\n' "$*" >&2; }

install_hint() {
    case "$1" in
    shellcheck) echo "mise use -g shellcheck   (or: brew install shellcheck)" ;;
    shfmt) echo "mise use -g shfmt   (or: brew install shfmt)" ;;
    *) echo "install ${1} with your package manager" ;;
    esac
}

# Print the install hint for each missing tool; return 1 if any is missing.
require_tools() {
    local tool missing=0
    for tool in bash shellcheck shfmt; do
        if ! command -v "${tool}" >/dev/null 2>&1; then
            log "Missing tool: ${tool}. Install it with: $(install_hint "${tool}")"
            missing=1
        fi
    done
    return "${missing}"
}

# Run one step; print PASS/FAIL, and the tool output on failure.
run_step() {
    local name="$1" file="$2"
    shift 2
    local out
    if out="$("$@" 2>&1)"; then
        echo "PASS ${name}: ${file}"
    else
        echo "FAIL ${name}: ${file}"
        [[ -z "${out}" ]] || echo "${out}"
        return 1
    fi
}

# Run all steps on one file. A syntax error stops that file: the other tools' output would be noise.
validate_file() {
    local file="$1" shfmt_flag="$2" status=0
    run_step "bash -n" "${file}" bash -n "${file}" || return 1
    run_step "shellcheck" "${file}" shellcheck -x "${file}" || status=1
    run_step "shfmt" "${file}" shfmt "${shfmt_flag}" "${file}" || status=1
    return "${status}"
}

# Set SHFMT_FLAG and FILES from the command line. Flags and files can come in any order.
parse_args() {
    SHFMT_FLAG="-w"
    FILES=()
    while [[ $# -gt 0 ]]; do
        case "$1" in
        -h | --help)
            usage
            exit 0
            ;;
        --check) SHFMT_FLAG="-d" ;;
        --)
            shift
            break
            ;;
        -?*) usage_error "unknown flag: $1" ;;
        *) FILES+=("$1") ;;
        esac
        shift
    done
    [[ $# -eq 0 ]] || FILES+=("$@")
    [[ ${#FILES[@]} -gt 0 ]] || usage_error "no <FILE> given"
}

main() {
    local file status=0
    parse_args "$@"
    require_tools || return 2
    for file in "${FILES[@]}"; do
        validate_file "${file}" "${SHFMT_FLAG}" || status=1
    done
    return "${status}"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
