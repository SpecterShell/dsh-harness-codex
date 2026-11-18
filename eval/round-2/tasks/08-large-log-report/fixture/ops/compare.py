"""Compare two report snapshots for the morning handoff."""
from .render import sorted_services

FIELDS = ("failures", "retried", "p95_ms")


def snapshots(previous, current):
    return previous, current


def delta(previous, current):
    rows = []
    current_services = current.get("services", {})
    previous_services = previous.get("services", {})
    for name in sorted(set(current_services) | set(previous_services)):
        before = previous_services.get(name, {})
        after = current_services.get(name, {})
        changes = {
            field: after.get(field, 0) - before.get(field, 0)
            for field in FIELDS
        }
        if any(changes.values()):
            rows.append({"service": name, **changes})
    return rows


def moved(previous, current, threshold=0.2):
    changes = []
    for name, bucket in sorted_services(current):
        before = previous.get("services", {}).get(name, {})
        old = before.get("failures", 0)
        new = bucket.get("failures", 0)
        if old > 0 and abs(new - old) / old > threshold:
            changes.append((name, old, new))
    return changes


def headline(previous, current):
    old = previous.get("total_failures", 0)
    new = current.get("total_failures", 0)
    direction = "up" if new > old else "down" if new < old else "flat"
    return f"failures {direction}: {old} -> {new}"
