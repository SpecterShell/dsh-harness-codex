#!/usr/bin/env bash
# Check task 08: warehouse filter on list and low-stock, old behaviour intact.
set -euo pipefail

repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests); then
  fail "unit tests failed"
fi

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 - "$repo" <<'PY'
import json
import os
import subprocess
import sys

repo = sys.argv[1]
env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}


def run(*args):
    result = subprocess.run(
        [sys.executable, "-m", "inventory.cli", "--data", "data/stock.json", *args],
        cwd=repo,
        text=True,
        capture_output=True,
        env=env,
    )
    if result.returncode != 0:
        raise SystemExit(f"command failed: {' '.join(args)}: {result.stderr.strip()}")
    return result.stdout


def payload(*args):
    return json.loads(run(*args))


def skus(payload_value):
    return [entry["sku"] for entry in payload_value["items"]]


full = payload("list", "--json")
assert full["count"] == 8, full
assert skus(full) == [
    "A-100", "A-101", "A-102", "B-200", "B-201", "B-202", "C-300", "C-301"
], skus(full)

ams = payload("list", "--json", "--warehouse", "ams")
assert ams["count"] == 3, ams
assert skus(ams) == ["A-100", "A-101", "A-102"], skus(ams)
assert {entry["warehouse"] for entry in ams["items"]} == {"ams"}
assert set(ams["items"][0]) == {
    "sku", "name", "warehouse", "quantity", "reorder_point", "unit_cost_cents"
}, ams["items"][0]

low_all = payload("low-stock", "--json")
assert skus(low_all) == ["A-101", "B-201", "C-300", "C-301"], skus(low_all)

low_berlin = payload("low-stock", "--json", "--warehouse", "berlin")
assert skus(low_berlin) == ["B-201"], skus(low_berlin)

low_lisbon = payload("low-stock", "--json", "--warehouse", "lisbon")
assert skus(low_lisbon) == ["C-300", "C-301"], skus(low_lisbon)

text = run("list", "--warehouse", "berlin")
assert "B-200" in text and "A-100" not in text, text
assert "SKU" in text and "WAREHOUSE" in text, text

value = payload("value", "--json")
assert value == {"total_value_cents": 15559}, value
print("warehouse filter checks ok")
PY
); then
  fail "CLI behaviour checks failed"
fi

echo "task 08 check passed"
