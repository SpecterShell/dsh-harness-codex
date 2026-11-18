import argparse
import json
from collections import defaultdict
from pathlib import Path

from .logparse import parse_file


def build_report(entries):
    errors = [entry for entry in entries if entry.level == "ERROR"]
    services = defaultdict(lambda: {"failures": 0, "retried": 0, "durations": []})
    for entry in errors:
        bucket = services[entry.service]
        bucket["failures"] += 1
        if entry.attempt > 1:
            bucket["retried"] += 1
        bucket["durations"].append(entry.duration_ms)

    summary = {}
    for name, bucket in services.items():
        durations = sorted(bucket["durations"])
        index = int(len(durations) * 0.95)
        index = min(index, len(durations) - 1)
        summary[name] = {
            "failures": bucket["failures"],
            "retried": bucket["retried"],
            "p95_ms": durations[index],
        }

    return {
        "total_failures": len(errors),
        "skipped_lines": 0,
        "services": summary,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(prog="ops.report")
    parser.add_argument("--log", default="logs/service.log")
    parser.add_argument("--out", default="out/report.json")
    args = parser.parse_args(argv)

    entries, skipped = parse_file(args.log)
    report = build_report(entries)
    report["skipped_lines"] = skipped
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
