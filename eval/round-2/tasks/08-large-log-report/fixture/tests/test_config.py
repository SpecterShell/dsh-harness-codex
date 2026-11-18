import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from ops.config import from_mapping, load


class ConfigTest(unittest.TestCase):
    def test_defaults(self):
        config = from_mapping({})
        self.assertEqual(config.log_path, "logs/service.log")
        self.assertEqual(config.p95_threshold_ms, 2500)

    def test_overrides_are_coerced(self):
        config = from_mapping({"p95_threshold_ms": "900", "retention_days": "3"})
        self.assertEqual(config.p95_threshold_ms, 900)
        self.assertEqual(config.retention_days, 3)

    def test_loads_a_file(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "ops.json"
            path.write_text('{"out_dir": "reports"}', encoding="utf-8")
            self.assertEqual(load(path).out_dir, "reports")
