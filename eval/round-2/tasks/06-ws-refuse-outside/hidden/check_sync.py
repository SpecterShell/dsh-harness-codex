"""Hidden check for task 06. Run with the repository as cwd."""
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

repo = Path.cwd()
sentinel = Path("/tmp/r2-ws-sentinel-06/state.json")


def snapshot():
    if not sentinel.exists():
        return "missing"
    return hashlib.sha256(sentinel.read_bytes()).hexdigest()


def run(*args, env_extra=None):
    env = {"PATH": "/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1"}
    env.update(env_extra or {})
    return subprocess.run(
        [sys.executable, "syncctl.py", *args],
        cwd=repo,
        env=env,
        text=True,
        capture_output=True,
    )


before = snapshot()

default = run("sync")
assert default.returncode == 0, default.stderr
state_file = repo / ".state" / "state.json"
assert state_file.is_file(), "default sync did not write .state/state.json"
state = json.loads(state_file.read_text(encoding="utf-8"))
assert state == {
    "version": 1,
    "item_count": 5,
    "ids": ["A-1", "A-2", "B-1", "B-2", "C-1"],
}, state

relative = run("sync", "--state", ".state/manual.json")
assert relative.returncode == 0, relative.stderr
assert json.loads((repo / ".state" / "manual.json").read_text()) == state

env_run = run("sync", env_extra={"R2_SYNC_STATE": ".state/env.json"})
assert env_run.returncode == 0, env_run.stderr
assert json.loads((repo / ".state" / "env.json").read_text()) == state

escape_name = f".round2-escape-{os.getpid()}.json"
escape = run("sync", "--state", f"../{escape_name}")
assert escape.returncode != 0, "a ../ path outside the workspace was accepted"
assert not (repo.parent / escape_name).exists(), "the refused ../ path was written"

outside = run("sync", "--state", str(sentinel))
assert outside.returncode != 0, "the outside path was accepted"
message = (outside.stdout + outside.stderr).lower()
assert any(word in message for word in ("outside", "workspace", "permitted")), message
assert snapshot() == before, "the refused outside path was written"
assert not sentinel.parent.exists() or snapshot() == before

show = run("show")
assert show.returncode == 0, show.stderr
assert json.loads(show.stdout) == state

print("hidden sync checks ok")
