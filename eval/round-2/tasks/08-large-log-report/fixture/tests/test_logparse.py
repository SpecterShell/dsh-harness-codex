import unittest
from pathlib import Path

from ops.logparse import parse_file, parse_line

LOG = Path(__file__).resolve().parent.parent / "logs" / "service.log"


class ParseLineTest(unittest.TestCase):
    def test_parses_a_full_line(self):
        entry = parse_line(
            '2026-03-01T00:00:00Z level=ERROR service=billing job=J-1 '
            'attempt=2 duration_ms=120 msg="card declined, retry"'
        )
        self.assertEqual(entry.service, "billing")
        self.assertEqual(entry.job, "J-1")
        self.assertEqual(entry.attempt, 2)
        self.assertEqual(entry.duration_ms, 120)
        self.assertEqual(entry.msg, "card declined, retry")

    def test_blank_line_is_not_an_entry(self):
        self.assertIsNone(parse_line("\n"))
        self.assertIsNone(parse_line("   \n"))


class ParseFileTest(unittest.TestCase):
    def test_reads_the_sample_log(self):
        entries, skipped = parse_file(LOG)
        self.assertGreater(len(entries), 1000)
        self.assertGreater(skipped, 0)
