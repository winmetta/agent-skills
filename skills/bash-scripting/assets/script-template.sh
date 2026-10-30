#!/usr/bin/env bash
# <one line: what this script does>
#
# Usage: script-name.sh [-h] <arg>
set -euo pipefail

readonly SCRIPT_NAME="${0##*/}"

usage() {
	cat <<USAGE
Usage: ${SCRIPT_NAME} [-h] <arg>

  -h  show this help
USAGE
}

log() { printf '%s\n' "$*" >&2; }

die() {
	log "${SCRIPT_NAME}: error: $*"
	exit 1
}

require_cmd() {
	command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

parse_args() {
	while getopts ':h' opt; do
		case "${opt}" in
		h)
			usage
			exit 0
			;;
		*) die "unknown option: -${OPTARG:-}" ;;
		esac
	done
	shift $((OPTIND - 1))
	[[ $# -ge 1 ]] || {
		usage >&2
		exit 1
	}
	ARG="$1"
}

main() {
	parse_args "$@"
	require_cmd printf
	log "working on ${ARG}"
}

# Run only when executed, so the functions can be sourced by tests.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
	main "$@"
fi
