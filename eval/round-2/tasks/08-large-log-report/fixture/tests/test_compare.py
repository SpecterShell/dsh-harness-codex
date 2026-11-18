import unittest

from ops.compare import delta, headline


class CompareTest(unittest.TestCase):
    def test_delta_only_reports_changed_services(self):
        previous = {"services": {"a": {"failures": 2, "retried": 0, "p95_ms": 100}}}
        current = {"services": {"a": {"failures": 3, "retried": 0, "p95_ms": 100}}}
        self.assertEqual(delta(previous, current), [{"service": "a", "failures": 1, "retried": 0, "p95_ms": 0}])

    def test_headline(self):
        self.assertEqual(headline({"total_failures": 2}, {"total_failures": 5}), "failures up: 2 -> 5")
