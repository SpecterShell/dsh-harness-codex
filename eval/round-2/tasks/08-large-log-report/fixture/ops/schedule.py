"""Cron schedule helpers (pure functions, no scheduler dependency)."""
from datetime import datetime, timedelta

FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def next_run(after, hour=2, minute=0):
    """Return the next daily run at or after `after`."""
    candidate = after.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= after:
        candidate += timedelta(days=1)
    return candidate


def due_runs(last_run, now, hour=2, minute=0):
    """Return every scheduled run between last_run and now."""
    runs = []
    cursor = last_run
    while True:
        candidate = next_run(cursor, hour=hour, minute=minute)
        if candidate > now:
            return runs
        runs.append(candidate)
        cursor = candidate


def format_time(value):
    return value.strftime(FORMAT)


def parse_time(value):
    return datetime.strptime(value, FORMAT)
