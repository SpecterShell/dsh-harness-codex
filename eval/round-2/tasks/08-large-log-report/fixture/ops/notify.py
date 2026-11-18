"""Alert text for services that cross the nightly threshold."""

TEMPLATE = (
    "{service}: {failures} failures, {retried} retried, p95 {p95_ms} ms "
    "(threshold {threshold} ms)"
)


def breaches(report, threshold_ms):
    return {
        name: bucket
        for name, bucket in report.get("services", {}).items()
        if bucket.get("p95_ms", 0) >= threshold_ms
    }


def messages(report, threshold_ms):
    return [
        TEMPLATE.format(service=name, threshold=threshold_ms, **bucket)
        for name, bucket in sorted(breaches(report, threshold_ms).items())
    ]


def summary_line(report, threshold_ms):
    count = len(breaches(report, threshold_ms))
    return f"{count} service(s) over {threshold_ms} ms"
