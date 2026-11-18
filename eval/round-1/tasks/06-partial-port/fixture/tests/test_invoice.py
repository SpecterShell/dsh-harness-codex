import unittest

from billing import build_invoice

ITEMS = [
    {"unit_price_cents": 1000, "quantity": 2},
    {"unit_price_cents": 500, "quantity": 1},
]


class InvoiceTests(unittest.TestCase):
    def test_default_tax(self):
        invoice = build_invoice({"order_id": "A-1", "items": ITEMS})
        self.assertEqual(invoice["total_cents"], 2706)

    def test_order_tax_rate(self):
        invoice = build_invoice({"order_id": "A-2", "items": ITEMS, "tax_rate": 0.2})
        self.assertEqual(invoice["total_cents"], 3000)

    def test_zero_tax(self):
        invoice = build_invoice({"order_id": "A-3", "items": ITEMS, "tax_rate": 0})
        self.assertEqual(invoice["total_cents"], 2500)


if __name__ == "__main__":
    unittest.main()
