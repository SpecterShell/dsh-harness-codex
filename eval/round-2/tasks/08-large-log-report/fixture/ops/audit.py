"""Audit trail for the nightly run."""
import json
from datetime import datetime, timezone
from pathlib import Path


def entry(action, detail=None):
    return {
        "time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "action": action,
        "detail": detail or {},
    }


def append(path, record):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")
    return target


def read(path):
    target = Path(path)
    if not target.is_file():
        return []
    return [json.loads(line) for line in target.read_text(encoding="utf-8").splitlines()]


def last(path):
    records = read(path)
    return records[-1] if records else None
