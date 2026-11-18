import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from inventory import cli
from inventory.models import Item
from inventory.storage import JsonStore


def item(sku, quantity, warehouse="ams", reorder_point=5):
    return Item(
        sku=sku,
        name=f"Item {sku}",
        warehouse=warehouse,
        quantity=quantity,
        reorder_point=reorder_point,
        unit_cost_cents=100,
    )


class CliTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "stock.json"
        JsonStore(self.path).save(
            [
                item("A-1", 2),
                item("A-2", 10),
                item("B-1", 1, warehouse="berlin"),
            ]
        )

    def run_cli(self, *argv):
        out = io.StringIO()
        err = io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = cli.main(["--data", str(self.path), *argv])
        return code, out.getvalue(), err.getvalue()

    def test_list_json(self):
        code, out, _ = self.run_cli("list", "--json")
        payload = json.loads(out)
        self.assertEqual(code, 0)
        self.assertEqual(payload["count"], 3)
        self.assertEqual([entry["sku"] for entry in payload["items"]], ["A-1", "A-2", "B-1"])

    def test_list_table(self):
        code, out, _ = self.run_cli("list")
        self.assertEqual(code, 0)
        self.assertIn("SKU", out)
        self.assertIn("A-1", out)

    def test_low_stock_json(self):
        code, out, _ = self.run_cli("low-stock", "--json")
        payload = json.loads(out)
        self.assertEqual(code, 0)
        self.assertEqual(payload["count"], 2)
        self.assertEqual([entry["sku"] for entry in payload["items"]], ["A-1", "B-1"])

    def test_value(self):
        code, out, _ = self.run_cli("value", "--json")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out), {"total_value_cents": 1300})

    def test_show_json(self):
        code, out, _ = self.run_cli("show", "A-2", "--json")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["quantity"], 10)

    def test_show_missing_sku(self):
        code, out, err = self.run_cli("show", "Z-9", "--json")
        self.assertEqual(code, 2)
        self.assertIn("unknown sku", err)

    def test_adjust_writes_file(self):
        code, out, _ = self.run_cli("adjust", "A-1", "5", "--json")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["quantity"], 7)
        self.assertEqual(JsonStore(self.path).load()[0].quantity, 7)

    def test_adjust_below_zero(self):
        code, _, err = self.run_cli("adjust", "A-1", "-5")
        self.assertEqual(code, 1)
        self.assertIn("would leave", err)


if __name__ == "__main__":
    unittest.main()
