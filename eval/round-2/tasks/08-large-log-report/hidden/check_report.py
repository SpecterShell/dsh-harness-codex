"""Hidden check for task 08: big-log report and a mini edge-case log."""
import json
import subprocess
import sys
from pathlib import Path

here = Path(__file__).resolve().parent
repo = Path.cwd()
out = repo / "out" / "report.json"

if not out.is_file():
    raise SystemExit("out/report.json is missing; the report was not run")
expected = json.loads((here / "expected.json").read_text(encoding="utf-8"))
actual = json.loads(out.read_text(encoding="utf-8"))
if actual != expected:
    raise SystemExit(f"out/report.json does not match: {json.dumps(actual)[:600]}")

mini_out = here / "mini-out.json"
result = subprocess.run(
    [sys.executable, "-m", "ops.report", "--log", str(here / "mini.log"), "--out", str(mini_out)],
    cwd=repo,
    text=True,
    capture_output=True,
    env={"PATH": "/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1"},
)
if result.returncode != 0:
    raise SystemExit(f"report failed on the mini log:\n{result.stderr}")
mini_expected = json.loads((here / "mini-expected.json").read_text(encoding="utf-8"))
mini_actual = json.loads(mini_out.read_text(encoding="utf-8"))
if mini_actual != mini_expected:
    raise SystemExit(f"mini log report mismatch: {json.dumps(mini_actual)}")
print("hidden report checks ok")
