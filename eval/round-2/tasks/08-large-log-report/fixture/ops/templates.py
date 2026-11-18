"""Plain-text artifacts built from a report."""
from pathlib import Path

HEADER = """nightly operations report
generated from {source}
"""


def cover_line(report, source="logs/service.log"):
    return HEADER.format(source=source).strip()


def bullet_list(report, limit=10):
    lines = []
    for service, bucket in sorted(report.get("services", {}).items())[:limit]:
        lines.append(
            f"- {service}: {bucket['failures']} failures, p95 {bucket['p95_ms']} ms"
        )
    return "\n".join(lines)


def write_digest(report, destination, source="logs/service.log"):
    path = Path(destination)
    path.parent.mkdir(parents=True, exist_ok=True)
    body = "\n".join(
        [cover_line(report, source), "", bullet_list(report), ""]
    )
    path.write_text(body, encoding="utf-8")
    return path
