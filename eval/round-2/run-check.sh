#!/usr/bin/env bash
# Round-2 wrapper: same contract as eval/run-check.sh.
# Usage: eval/round-2/run-check.sh <task-dir> <work-dir>
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
exec bash "$here/../round-1/run-check.sh" "$@"
