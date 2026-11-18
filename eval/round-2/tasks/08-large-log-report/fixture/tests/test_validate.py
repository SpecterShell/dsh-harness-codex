import unittest

from ops.validate import validate_report


class ValidateReportTest(unittest.TestCase):
    def test_accepts_a_good_report(self):
        self.assertEqual(
            validate_report(
                {
                    "total_failures": 1,
                    "skipped_lines": 0,
                    "services": {
                        "billing": {"failures": 1, "retried": 0, "p95_ms": 100}
                    },
                }
            ),
            [],
        )

    def test_reports_missing_keys(self):
        errors = validate_report({"services": {}})
        self.assertIn("missing top-level keys: ['skipped_lines', 'total_failures']", errors)
