"""Attach operator notes to a report without touching the numbers."""
from datetime import datetime, timezone
from pathlib import Path
import json


def note(text, author="on-call"):
    return {
        "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "author": author,
        "text": text,
    }


def attach(report, text, author="on-call"):
    copy = json.loads(json.dumps(report))
    copy.setdefault("notes", []).append(note(text, author))
    return copy


def write(report, destination):
    path = Path(destination)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return path
