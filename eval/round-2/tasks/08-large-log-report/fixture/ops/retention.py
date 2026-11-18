"""Retention policy for generated report artifacts."""
from datetime import datetime, timedelta
from pathlib import Path

SUFFIXES = (".json", ".csv", ".txt")


def artifacts(out_dir):
    root = Path(out_dir)
    if not root.is_dir():
        return []
    return sorted(
        path for path in root.iterdir() if path.is_file() and path.suffix in SUFFIXES
    )


def expired(paths, now, days):
    cutoff = now - timedelta(days=days)
    return [path for path in paths if datetime.fromtimestamp(path.stat().st_mtime) < cutoff]


def plan_cleanup(out_dir, now, days):
    return expired(artifacts(out_dir), now, days)
