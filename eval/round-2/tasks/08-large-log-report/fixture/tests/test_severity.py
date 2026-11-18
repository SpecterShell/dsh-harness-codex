import unittest

from ops.severity import per_service, severity


class SeverityTest(unittest.TestCase):
    def test_ladder(self):
        self.assertEqual(severity(3200), "page")
        self.assertEqual(severity(2500), "warn")
        self.assertEqual(severity(999), "info")

    def test_per_service(self):
        report = {"services": {"a": {"p95_ms": 2500}, "b": {"p95_ms": 500}}}
        self.assertEqual(per_service(report), {"a": "warn", "b": "info"})
