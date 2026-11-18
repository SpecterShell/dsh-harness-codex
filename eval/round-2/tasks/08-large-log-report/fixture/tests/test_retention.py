import unittest
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

from ops.retention import plan_cleanup


class RetentionTest(unittest.TestCase):
    def test_missing_dir_has_no_artifacts(self):
        self.assertEqual(plan_cleanup("/nonexistent/ops", datetime(2026, 1, 1), 7), [])

    def test_filters_by_suffix(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "report.json").write_text("{}", encoding="utf-8")
            (root / "notes.md").write_text("keep", encoding="utf-8")
            future = datetime.now() + timedelta(days=30)
            self.assertEqual(
                [path.name for path in plan_cleanup(root, future, 7)],
                ["report.json"],
            )
