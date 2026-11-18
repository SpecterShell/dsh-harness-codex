import unittest

from billing import build_quote

ITEMS = [
    {"unit_price_cents": 1000, "quantity": 2},
    {"unit_price_cents": 500, "quantity": 1},
]


class QuoteTests(unittest.TestCase):
    def test_quote_is_pre_tax(self):
        quote = build_quote({"order_id": "Q-1", "items": ITEMS})
        self.assertEqual(quote["total_cents"], 2500)

    def test_order_tax_rate_is_ignored(self):
        quote = build_quote({"order_id": "Q-2", "items": ITEMS, "tax_rate": 0.2})
        self.assertEqual(quote["total_cents"], 2500)


if __name__ == "__main__":
    unittest.main()
