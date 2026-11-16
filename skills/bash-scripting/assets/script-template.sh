#!/usr/bin/env bash
# <one line: what this script does>
#
# Usage: script-name.sh [FLAGS] <FILE>
set -euo pipefail

readonly SCRIPT_NAME="${0##*/}"

# Help layout: see references/usage-help.md in the bash-scripting skill.
usage() {
    cat <<USAGE
<One line: what this script does>

Usage: ${SCRIPT_NAME} [FLAGS] <FILE>

Arguments:
  <FILE>  File to work on

Flags:
  -o, --output <FILE>  Write the result to FILE [default: stdout]
  -n, --dry-run        Print what would change without changing it
  -h, --help           Print help

Examples:
    \$ ${SCRIPT_NAME} input.txt

    \$ ${SCRIPT_NAME} --output result.txt input.txt
USAGE
}

log() { printf '%s\n' "$*" >&2; }

die() {
    log "${SCRIPT_NAME}: error: $*"
    exit 1
}

# Report a usage error on stderr and exit 2, like clap-based CLIs.
usage_error() {
    log "${SCRIPT_NAME}: error: $*"
    log ""
    log "Usage: ${SCRIPT_NAME} [FLAGS] <FILE>"
    log ""
    log "For more information, try '--help'."
    exit 2
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

# Set OUTPUT, DRY_RUN and FILE from the command line.
parse_args() {
    OUTPUT="" DRY_RUN=0
    while [[ $# -gt 0 ]]; do
        case "$1" in
        -h | --help)
            usage
            exit 0
            ;;
        -n | --dry-run) DRY_RUN=1 ;;
        -o | --output)
            [[ $# -ge 2 ]] || usage_error "$1 needs a value"
            OUTPUT="$2"
            shift
            ;;
        --output=*) OUTPUT="${1#*=}" ;;
        --)
            shift
            break
            ;;
        -?*) usage_error "unknown flag: $1" ;;
        *) break ;;
        esac
        shift
    done
    [[ $# -eq 1 ]] || usage_error "expected one <FILE>, got $#"
    FILE="$1"
}

main() {
    parse_args "$@"
    require_cmd printf
    log "working on ${FILE} (output: ${OUTPUT:-stdout}, dry run: ${DRY_RUN})"
}

# Run only when executed, so the functions can be sourced by tests.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
