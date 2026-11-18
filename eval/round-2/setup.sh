#!/usr/bin/env bash
# Round-2 wrapper: same contract as eval/setup.sh.
# Usage: eval/round-2/setup.sh <task-dir> <work-dir>
# Refuses a work dir that exists and is not empty, and leaves hidden/ out of
# the working copy.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
bash "$here/../round-1/setup.sh" "$@"
# Large fixtures are stored gzipped; expand them so the agent sees plain files.
work=${2:?}
find "$work" -name '*.gz' -not -path '*/.git/*' -print0 | while IFS= read -r -d '' file; do
  gunzip -- "$file"
done
if [ -n "$(git -C "$work" status --porcelain)" ]; then
  git -C "$work" add -A
  git -C "$work" -c user.name=eval -c user.email=eval@localhost -c commit.gpgsign=false commit -q --amend --no-edit
fi
