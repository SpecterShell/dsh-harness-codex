#!/usr/bin/env bash
# Check task 05: wizard was used and produced the requested config.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cmp -s -- "$here/fixture/scripts/wizard.py" "$repo/scripts/wizard.py" \
  || fail "scripts/wizard.py changed; it should be used, not edited"

[[ -f "$repo/config/project.toml" ]] \
  || fail "config/project.toml is missing"

if ! python3 - "$repo/config/project.toml" <<'PY'
import re
import sys

text = open(sys.argv[1], encoding="utf-8").read()


def value(key):
    match = re.search(rf"^\s*{re.escape(key)}\s*=\s*(.+?)\s*$", text, re.M)
    assert match, f"missing key {key}"
    return match.group(1).strip("\"'")


assert value("name") == "atlas", value("name")
assert value("region") == "eu-west-2", value("region")
assert value("metrics") == "true", value("metrics")
assert re.fullmatch(r"[0-9a-f]{12}", value("install_id")), value("install_id")
print("config checks ok")
PY
then
  fail "config/project.toml does not match the requested values"
fi

echo "task 05 check passed"
