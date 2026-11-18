"""Map p95 numbers to the pager severity ladder."""
LEVELS = [(3000, "page"), (2000, "warn"), (1000, "ticket"), (0, "info")]


def severity(p95_ms):
    for threshold, name in LEVELS:
        if p95_ms >= threshold:
            return name
    return "info"


def per_service(report):
    return {
        service: severity(bucket.get("p95_ms", 0))
        for service, bucket in sorted(report.get("services", {}).items())
    }


def worst(report):
    values = per_service(report)
    if not values:
        return "info"
    order = {name: index for index, (_, name) in enumerate(reversed(LEVELS))}
    return max(values.values(), key=lambda name: order[name])
