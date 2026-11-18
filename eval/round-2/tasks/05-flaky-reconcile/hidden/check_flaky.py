"""Hidden check for task 05: determinism across hash seeds and retry handling."""
import json
import os
import subprocess
import sys
from pathlib import Path

repo = Path.cwd()
data = Path(sys.argv[1])
expected = {
    "acme": {"total_cents": 250, "count": 1},
    "globex": {"total_cents": 500, "count": 1},
    "initech": {"total_cents": -100, "count": 1},
}
expected_json = json.dumps(expected)

code = (
    "import json, sys;"
    "from ledger.reconcile import reconcile;"
    "from ledger.store import load_rows;"
    "print(json.dumps(reconcile(load_rows(sys.argv[1]))))"
)

outputs = []
for seed in range(24):
    env = {
        "PATH": "/usr/bin:/bin",
        "PYTHONHASHSEED": str(seed),
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    result = subprocess.run(
        [sys.executable, "-c", code, str(data)],
        cwd=repo,
        env=env,
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        raise SystemExit(f"seed {seed} failed:\n{result.stderr}")
    outputs.append(result.stdout.strip())

if len(set(outputs)) != 1:
    raise SystemExit(f"output changes with the hash seed: {sorted(set(outputs))[:4]}")
if outputs[0] != expected_json:
    raise SystemExit(f"wrong result: {outputs[0]}")
print(f"hidden reconcile checks ok (24 seeds, {len(outputs)} runs)")
