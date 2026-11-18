"""Build the small dashboard payload embedded in the pager."""
from .notify import breaches
from .render import sorted_services


def build(report, threshold_ms):
    over = breaches(report, threshold_ms)
    return {
        "total_failures": report.get("total_failures", 0),
        "skipped_lines": report.get("skipped_lines", 0),
        "over_threshold": sorted(over),
        "services": [
            {
                "name": name,
                "failures": bucket["failures"],
                "retried": bucket["retried"],
                "p95_ms": bucket["p95_ms"],
                "over": name in over,
            }
            for name, bucket in sorted_services(report)
        ],
    }
