"""Validation for a report loaded from disk."""
import json
from pathlib import Path

TOP_LEVEL = {"total_failures", "skipped_lines", "services"}
SERVICE_KEYS = {"failures", "retried", "p95_ms"}


def validate_report(report):
    errors = []
    if not isinstance(report, dict):
        return ["report is not an object"]
    missing = TOP_LEVEL - set(report)
    if missing:
        errors.append(f"missing top-level keys: {sorted(missing)}")
    for key in ("total_failures", "skipped_lines"):
        if key in report and not isinstance(report[key], int):
            errors.append(f"{key} is not an integer")
    services = report.get("services", {})
    if not isinstance(services, dict):
        errors.append("services is not an object")
    else:
        for name, bucket in services.items():
            if not isinstance(bucket, dict):
                errors.append(f"{name} is not an object")
                continue
            if set(bucket) != SERVICE_KEYS:
                errors.append(f"{name} has keys {sorted(bucket)}")
            for key in ("failures", "retried"):
                if key in bucket and not isinstance(bucket[key], int):
                    errors.append(f"{name}.{key} is not an integer")
            if "p95_ms" in bucket and not isinstance(bucket["p95_ms"], int):
                errors.append(f"{name}.p95_ms is not an integer")
    return errors


def load_and_validate(path):
    report = json.loads(Path(path).read_text(encoding="utf-8"))
    errors = validate_report(report)
    if errors:
        raise ValueError("; ".join(errors))
    return report
