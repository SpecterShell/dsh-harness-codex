#!/usr/bin/env bash
# Create a fresh, identical working copy of one task fixture.
#
# Usage: eval/setup.sh <task-dir> <work-dir>
#
# <task-dir> is a directory under eval/tasks/. <work-dir> must not exist yet,
# or must be an empty directory. The fixture is copied there and committed as
# a single initial commit so every run starts from the same state.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <task-dir> <work-dir>" >&2
  exit 2
fi

task_dir=$1
work_dir=$2

[[ -d "$task_dir" ]] || { echo "no such task dir: $task_dir" >&2; exit 2; }
task_dir=$(cd -- "$task_dir" && pwd)
[[ -d "$task_dir/fixture" ]] || { echo "task has no fixture/: $task_dir" >&2; exit 2; }

if [[ -e "$work_dir" ]]; then
  [[ -d "$work_dir" ]] || { echo "work dir is not a directory: $work_dir" >&2; exit 2; }
  if [[ -n "$(ls -A -- "$work_dir")" ]]; then
    echo "refusing to use non-empty work dir: $work_dir" >&2
    exit 2
  fi
else
  mkdir -p -- "$work_dir"
fi

work_dir=$(cd -- "$work_dir" && pwd)

cp -a -- "$task_dir/fixture/." "$work_dir/"

cd -- "$work_dir"
git init -q -b main
git config user.name "DSH Eval"
git config user.email "eval@dsh.invalid"
git add -A
git -c commit.gpgsign=false commit -q -m "Initial fixture"

echo "prepared $work_dir from $task_dir"
