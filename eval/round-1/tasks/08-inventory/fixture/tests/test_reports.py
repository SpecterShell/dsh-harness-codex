import unittest

from inventory.models import Item
from inventory.reports import format_cents, render_items, render_low_stock


def item(sku="A-100", quantity=2, reorder_point=5):
    return Item(
        sku=sku,
        name="Widget",
        warehouse="ams",
        quantity=quantity,
        reorder_point=reorder_point,
        unit_cost_cents=1250,
    )


class ReportTests(unittest.TestCase):
    def test_format_cents(self):
        self.assertEqual(format_cents(1250), "$12.50")
        self.assertEqual(format_cents(123456), "$1,234.56")
        self.assertEqual(format_cents(0), "$0.00")

    def test_items_table_has_header_and_row(self):
        text = render_items([item()])
        self.assertIn("SKU", text)
        self.assertIn("WAREHOUSE", text)
        self.assertIn("A-100", text)
        self.assertIn("$25.00", text)

    def test_low_stock_table_shows_shortfall(self):
        text = render_low_stock([item(quantity=2, reorder_point=5)])
        self.assertIn("SHORTFALL", text)
        self.assertIn("A-100", text)
        self.assertIn("3", text)


if __name__ == "__main__":
    unittest.main()
