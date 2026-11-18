import unittest

from ops.sla import Budget, budgets, breaches


class BudgetTest(unittest.TestCase):
    def test_over(self):
        budget = Budget("billing", 1000)
        self.assertFalse(budget.over(999))
        self.assertTrue(budget.over(1001))

    def test_breaches(self):
        report = {"services": {"a": {"p95_ms": 500}, "b": {"p95_ms": 1500}}}
        result = breaches(report, budgets([{"service": "a", "budget_ms": 1000},
                                           {"service": "b", "budget_ms": 1000}]))
        self.assertEqual(result, [("b", 1500, 1000)])
