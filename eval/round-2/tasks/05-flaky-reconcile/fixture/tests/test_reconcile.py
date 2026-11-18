import json
import unittest
from pathlib import Path

from ledger.reconcile import reconcile
from ledger.store import load_rows

DATA = Path(__file__).resolve().parent.parent / "data" / "transactions.csv"


class ReconcileTest(unittest.TestCase):
    def setUp(self):
        self.rows = load_rows(DATA)

    def test_totals(self):
        result = reconcile(self.rows)
        self.assertEqual(result["acme"], {"total_cents": 1550, "count": 2})
        self.assertEqual(result["globex"], {"total_cents": 1050, "count": 2})
        self.assertEqual(result["initech"], {"total_cents": -400, "count": 1})

    def test_output_order_is_account_order(self):
        result = reconcile(self.rows)
        self.assertEqual(json.dumps(result), json.dumps({
            "acme": {"total_cents": 1550, "count": 2},
            "globex": {"total_cents": 1050, "count": 2},
            "initech": {"total_cents": -400, "count": 1},
        }))
