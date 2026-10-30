#!/usr/bin/env bash
# Validate and format Bash scripts: bash -n, ShellCheck, then shfmt.
#
# Usage: validate-bash.sh [--check] <file.sh>...
#   default   shfmt rewrites the files in place (-w), then they are checked
#   --check   report only; shfmt shows a diff (-d) and no file is changed
# Exit codes: 0 all clean, 1 a check failed, 2 a tool is missing or usage error.
# shfmt with no style flags reads .editorconfig, so the repo's own indent settings win.
set -euo pipefail

readonly SCRIPT_NAME="${0##*/}"

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

main() {
	local shfmt_flag="-w" file status=0
	if [[ "${1:-}" == "--check" ]]; then
		shfmt_flag="-d"
		shift
	fi
	if [[ $# -eq 0 ]]; then
		log "Usage: ${SCRIPT_NAME} [--check] <file.sh>..."
		return 2
	fi
	require_tools || return 2
	for file in "$@"; do
		validate_file "${file}" "${shfmt_flag}" || status=1
	done
	return "${status}"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
	main "$@"
fi
