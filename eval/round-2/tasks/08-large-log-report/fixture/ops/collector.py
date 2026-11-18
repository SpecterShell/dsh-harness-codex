"""Glue used by the cron entry point (not exercised by the tests)."""
from pathlib import Path

from .export import write_csv
from .logparse import parse_file
from .notify import messages
from .render import write_text
from .report import build_report
from .rotate import rotate


def collect(log_path, out_dir, threshold_ms=2500):
    rotate(log_path, limit_bytes=50 * 1024 * 1024)
    entries, skipped = parse_file(log_path)
    report = build_report(entries)
    report["skipped_lines"] = skipped
    out = Path(out_dir)
    write_text(report, out / "report.txt")
    write_csv(report, out / "report.csv")
    return report, messages(report, threshold_ms)
