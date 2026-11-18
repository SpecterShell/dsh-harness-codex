#!/usr/bin/env bash
# Check task 09: a documented choice for empty configs, implemented consistently.
set -euo pipefail

repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

if ! decision=$(python3 - "$repo/README.md" <<'PY'
import re
import sys

text = open(sys.argv[1], encoding="utf-8").read()
match = re.search(r"^Empty config:\s*(.*)$", text, re.M | re.I)
if not match:
    raise SystemExit("no 'Empty config:' line in README.md")
value = match.group(1).lower()
has_default = "default" in value
has_error = "error" in value
if has_default == has_error:
    raise SystemExit("the 'Empty config:' line must say exactly one of defaults or error")
print("defaults" if has_default else "error")
PY
); then
  fail "README.md does not document a single choice on an 'Empty config:' line"
fi

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 - "$decision" <<'PY'
import json
import subprocess
import sys
import tempfile
from pathlib import Path

mode = sys.argv[1]


def run(*args):
    return subprocess.run(
        [sys.executable, "status.py", *args],
        text=True,
        capture_output=True,
        env={"PYTHONDONTWRITEBYTECODE": "1", "PATH": "/usr/bin:/bin"},
    )


def assert_defaults(result):
    assert result.returncode == 0, (result.returncode, result.stderr)
    payload = json.loads(result.stdout)
    assert payload == {"healthy": True, "name": "unknown", "port": 8080}, payload


def assert_error(result):
    assert result.returncode != 0, (result.returncode, result.stdout)
    assert "Traceback" not in result.stderr, result.stderr
    assert "empty" in result.stderr.lower(), result.stderr


with tempfile.TemporaryDirectory() as directory:
    empty = Path(directory) / "empty.json"
    empty.write_text("", encoding="utf-8")

    result = run("--config", str(empty), "--json")
    if mode == "defaults":
        assert_defaults(result)
    else:
        assert_error(result)

    # The checked-in config is empty, so the default path must follow the same choice.
    result = run("--json")
    if mode == "defaults":
        assert_defaults(result)
    else:
        assert_error(result)

    config = Path(directory) / "service.json"
    config.write_text(json.dumps({"name": "atlas", "port": 9000}), encoding="utf-8")

    result = run("--config", str(config), "--json")
    assert result.returncode == 0, (result.returncode, result.stderr)
    assert json.loads(result.stdout) == {"healthy": True, "name": "atlas", "port": 9000}

    result = run("--config", str(config))
    assert result.returncode == 0, (result.returncode, result.stderr)
    assert "atlas is up on port 9000" in result.stdout, result.stdout

print(f"empty-config behaviour ok ({mode})")
PY
); then
  fail "the command does not match the documented choice"
fi

echo "task 09 check passed"
