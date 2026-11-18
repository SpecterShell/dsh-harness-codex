import json
import tempfile
import unittest
from pathlib import Path

from inventory.errors import StorageError
from inventory.models import Item
from inventory.storage import JsonStore


def item(sku="A-100", quantity=2):
    return Item(
        sku=sku,
        name="Widget",
        warehouse="ams",
        quantity=quantity,
        reorder_point=1,
        unit_cost_cents=100,
    )


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "stock.json"

    def write(self, text):
        self.path.write_text(text, encoding="utf-8")

    def test_round_trip(self):
        store = JsonStore(self.path)
        store.save([item(), item("A-101", 4)])
        self.assertEqual([entry.quantity for entry in store.load()], [2, 4])

    def test_missing_file(self):
        with self.assertRaises(StorageError):
            JsonStore(self.path).load()

    def test_invalid_json(self):
        self.write("{not json")
        with self.assertRaises(StorageError):
            JsonStore(self.path).load()

    def test_missing_items_array(self):
        self.write(json.dumps({"stock": []}))
        with self.assertRaises(StorageError):
            JsonStore(self.path).load()

    def test_invalid_item(self):
        self.write(json.dumps({"items": [{"sku": "A-100"}]}))
        with self.assertRaises(StorageError):
            JsonStore(self.path).load()

    def test_save_is_readable_json(self):
        JsonStore(self.path).save([item()])
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        self.assertEqual(payload["items"][0]["sku"], "A-100")


if __name__ == "__main__":
    unittest.main()
