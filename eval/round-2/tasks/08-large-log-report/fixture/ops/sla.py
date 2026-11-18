"""Service level budget helpers for the nightly report."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Budget:
    service: str
    budget_ms: int

    def used(self, p95_ms):
        if self.budget_ms <= 0:
            raise ValueError("budget must be positive")
        return p95_ms / self.budget_ms

    def over(self, p95_ms):
        return self.used(p95_ms) > 1.0


def budgets(rows):
    return {row["service"]: Budget(row["service"], int(row["budget_ms"])) for row in rows}


def breaches(report, budgets_by_service):
    result = []
    for service, bucket in sorted(report.get("services", {}).items()):
        budget = budgets_by_service.get(service)
        if budget is not None and budget.over(bucket.get("p95_ms", 0)):
            result.append((service, bucket.get("p95_ms", 0), budget.budget_ms))
    return result
