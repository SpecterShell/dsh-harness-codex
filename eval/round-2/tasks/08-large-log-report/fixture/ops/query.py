"""Ad-hoc queries over a parsed log, used by the on-call console."""
from collections import Counter


def by_service(entries):
    counts = Counter(entry.service for entry in entries if entry.level == "ERROR")
    return dict(sorted(counts.items()))


def slowest(entries, limit=10):
    rows = sorted(
        (entry for entry in entries if entry.level == "ERROR"),
        key=lambda entry: entry.duration_ms,
        reverse=True,
    )
    return rows[:limit]


def search(entries, needle):
    needle = needle.lower()
    return [
        entry
        for entry in entries
        if needle in entry.msg.lower() or needle in entry.job.lower()
    ]


def first_error(entries):
    for entry in entries:
        if entry.level == "ERROR":
            return entry
    return None


def attempts_for(entries, job):
    return [entry.attempt for entry in entries if entry.job == job]


def summary_line(entries):
    failures = sum(1 for entry in entries if entry.level == "ERROR")
    return f"{len(entries)} entries, {failures} errors"
