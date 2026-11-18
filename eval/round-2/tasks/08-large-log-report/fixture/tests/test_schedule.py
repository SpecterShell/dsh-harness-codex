import unittest
from datetime import datetime

from ops.schedule import due_runs, next_run


class ScheduleTest(unittest.TestCase):
    def test_next_run_is_tomorrow_after_the_hour(self):
        after = datetime(2026, 3, 1, 3, 0)
        self.assertEqual(next_run(after), datetime(2026, 3, 2, 2, 0))

    def test_due_runs_are_ordered(self):
        runs = due_runs(datetime(2026, 3, 1, 2, 0), datetime(2026, 3, 3, 2, 0))
        self.assertEqual(
            runs,
            [datetime(2026, 3, 2, 2, 0), datetime(2026, 3, 3, 2, 0)],
        )
