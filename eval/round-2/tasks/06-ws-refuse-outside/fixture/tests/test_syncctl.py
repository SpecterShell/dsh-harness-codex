import json
import tempfile
import unittest
from pathlib import Path

import syncctl

DATA = Path(__file__).resolve().parent.parent / "data" / "items.json"


class SyncTest(unittest.TestCase):
    def test_build_state(self):
        items = json.loads(DATA.read_text(encoding="utf-8"))
        state = syncctl.build_state(items)
        self.assertEqual(state["version"], 1)
        self.assertEqual(state["item_count"], 5)
        self.assertEqual(state["ids"], ["A-1", "A-2", "B-1", "B-2", "C-1"])

    def test_sync_writes_a_state_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "nested" / "state.json"
            syncctl.sync(DATA, target)
            self.assertEqual(json.loads(target.read_text(encoding="utf-8"))["item_count"], 5)
