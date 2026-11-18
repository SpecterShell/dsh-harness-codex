"""Export the report as CSV for the weekly spreadsheet."""
import csv
from pathlib import Path

FIELDS = ["service", "failures", "retried", "p95_ms"]


def rows(report):
    for service in sorted(report.get("services", {})):
        bucket = report["services"][service]
        yield {
            "service": service,
            "failures": bucket["failures"],
            "retried": bucket["retried"],
            "p95_ms": bucket["p95_ms"],
        }


def write_csv(report, destination):
    path = Path(destination)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows(report))
    return path
