"""Human-readable rendering of a nightly report."""
from pathlib import Path


def sorted_services(report):
    return sorted(report.get("services", {}).items())


def header():
    return f"{'SERVICE':<12} {'FAILURES':>8} {'RETRIED':>7} {'P95 MS':>7}"


def row(service, bucket):
    return (
        f"{service:<12} {bucket.get('failures', 0):>8} "
        f"{bucket.get('retried', 0):>7} {bucket.get('p95_ms', 0):>7}"
    )


def render(report):
    lines = [
        header(),
        f"total failures: {report.get('total_failures', 0)}",
        f"skipped lines: {report.get('skipped_lines', 0)}",
        "",
    ]
    lines.extend(row(service, bucket) for service, bucket in sorted_services(report))
    return "\n".join(lines)


def write_text(report, destination):
    path = Path(destination)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render(report) + "\n", encoding="utf-8")
    return path
