"""Write a compact archive copy of a report."""
import json
from pathlib import Path


def archive(report, destination):
    path = Path(destination)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, sort_keys=True), encoding="utf-8")
    return path
