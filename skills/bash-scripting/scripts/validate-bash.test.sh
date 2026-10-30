#!/usr/bin/env bash
# Tests for validate-bash.sh. Run: bash validate-bash.test.sh (exits non-zero on failure).
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly VALIDATE="${HERE}/validate-bash.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT
FAILURES=0

# expect_status <name> <expected exit code> <command...>
expect_status() {
	local name="$1" want="$2" got
	shift 2
	"$@" >/dev/null 2>&1
	got=$?
	if [[ "${got}" -eq "${want}" ]]; then
		echo "ok - ${name}"
	else
		echo "not ok - ${name} (exit ${got}, wanted ${want})"
		FAILURES=$((FAILURES + 1))
	fi
}

write_file() { printf '%b' "$2" >"${TMP}/$1"; }

test_no_args_is_usage_error() {
	expect_status "no files is a usage error" 2 bash "${VALIDATE}"
}

test_clean_script_passes() {
	write_file ok.sh '#!/usr/bin/env bash\nset -euo pipefail\n\nmain() {\n\techo "hi"\n}\n\nmain "$@"\n'
	expect_status "clean script passes" 0 bash "${VALIDATE}" --check "${TMP}/ok.sh"
}

test_shellcheck_finding_fails() {
	# shellcheck disable=SC2016 # the unquoted $1 is the deliberate finding in the fixture
	write_file bad.sh '#!/usr/bin/env bash\nrm -rf $1\n'
	expect_status "shellcheck finding fails" 1 bash "${VALIDATE}" --check "${TMP}/bad.sh"
}

test_syntax_error_fails() {
	write_file syntax.sh '#!/usr/bin/env bash\nif then\n'
	expect_status "syntax error fails" 1 bash "${VALIDATE}" --check "${TMP}/syntax.sh"
}

test_check_mode_reports_format_without_changing() {
	write_file fmt.sh '#!/usr/bin/env bash\nmain() {\necho "hi"\n}\nmain\n'
	expect_status "--check fails on unformatted code" 1 bash "${VALIDATE}" --check "${TMP}/fmt.sh"
	if grep -q '^echo' "${TMP}/fmt.sh"; then
		echo "ok - --check leaves the file unchanged"
	else
		echo "not ok - --check changed the file"
		FAILURES=$((FAILURES + 1))
	fi
}

test_default_mode_formats_in_place() {
	expect_status "default mode formats and passes" 0 bash "${VALIDATE}" "${TMP}/fmt.sh"
	if grep -q "$(printf '^\techo')" "${TMP}/fmt.sh"; then
		echo "ok - default mode indents the file"
	else
		echo "not ok - default mode did not format the file"
		FAILURES=$((FAILURES + 1))
	fi
}

test_missing_tool_exits_2() {
	# An empty PATH directory hides every tool; bash itself is invoked by absolute path.
	local empty="${TMP}/empty"
	mkdir -p "${empty}"
	expect_status "missing tool exits 2" 2 env PATH="${empty}" "$(command -v bash)" "${VALIDATE}" "${TMP}/ok.sh"
}

main() {
	test_no_args_is_usage_error
	test_clean_script_passes
	test_shellcheck_finding_fails
	test_syntax_error_fails
	test_check_mode_reports_format_without_changing
	test_default_mode_formats_in_place
	test_missing_tool_exits_2
	if [[ "${FAILURES}" -gt 0 ]]; then
		echo "${FAILURES} failed"
		exit 1
	fi
	echo "all passed"
}

main
