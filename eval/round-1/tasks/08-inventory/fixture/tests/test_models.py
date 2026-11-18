import unittest

from inventory.errors import ValidationError
from inventory.models import Item


def make_item(**overrides):
    values = {
        "sku": "A-100",
        "name": "Widget",
        "warehouse": "ams",
        "quantity": 12,
        "reorder_point": 5,
        "unit_cost_cents": 450,
    }
    values.update(overrides)
    return Item(**values)


class ItemTests(unittest.TestCase):
    def test_value_uses_quantity(self):
        self.assertEqual(make_item(quantity=4).value_cents, 1800)

    def test_reorder_boundary_counts_as_low(self):
        self.assertTrue(make_item(quantity=5).needs_reorder)
        self.assertFalse(make_item(quantity=6).needs_reorder)

    def test_shortfall_is_zero_above_reorder_point(self):
        self.assertEqual(make_item(quantity=9).shortfall, 0)
        self.assertEqual(make_item(quantity=2).shortfall, 3)

    def test_round_trips_through_dict(self):
        item = make_item()
        self.assertEqual(Item.from_dict(item.to_dict()), item)

    def test_rejects_negative_quantity(self):
        with self.assertRaises(ValidationError):
            make_item(quantity=-1)

    def test_rejects_blank_sku(self):
        with self.assertRaises(ValidationError):
            make_item(sku="  ")

    def test_rejects_zero_cost(self):
        with self.assertRaises(ValidationError):
            make_item(unit_cost_cents=0)

    def test_with_quantity_keeps_other_fields(self):
        changed = make_item().with_quantity(1)
        self.assertEqual(changed.quantity, 1)
        self.assertEqual(changed.warehouse, "ams")


if __name__ == "__main__":
    unittest.main()
