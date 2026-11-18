import unittest

from inventory.errors import NotFoundError, ValidationError
from inventory.models import Item
from inventory.service import InventoryService


def item(sku, quantity, reorder_point=5, warehouse="ams"):
    return Item(
        sku=sku,
        name=f"Item {sku}",
        warehouse=warehouse,
        quantity=quantity,
        reorder_point=reorder_point,
        unit_cost_cents=100,
    )


class MemoryStore:
    def __init__(self, items):
        self.items = list(items)
        self.saves = 0

    def load(self):
        return list(self.items)

    def save(self, items):
        self.items = list(items)
        self.saves += 1


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.store = MemoryStore(
            [
                item("B-2", 10, warehouse="berlin"),
                item("A-1", 2, warehouse="ams"),
                item("A-3", 9, warehouse="ams"),
            ]
        )
        self.service = InventoryService(self.store)

    def test_list_is_sorted_by_sku(self):
        self.assertEqual(
            [entry.sku for entry in self.service.list_items()], ["A-1", "A-3", "B-2"]
        )

    def test_low_stock_includes_boundary(self):
        self.assertEqual(
            [entry.sku for entry in self.service.low_stock()], ["A-1"]
        )

    def test_get_item(self):
        self.assertEqual(self.service.get_item("A-3").quantity, 9)

    def test_get_missing_item(self):
        with self.assertRaises(NotFoundError):
            self.service.get_item("Z-9")

    def test_total_value(self):
        self.assertEqual(self.service.total_value(), 2100)

    def test_adjust_saves(self):
        updated = self.service.adjust("A-1", 3)
        self.assertEqual(updated.quantity, 5)
        self.assertEqual(self.service.get_item("A-1").quantity, 5)
        self.assertEqual(self.store.saves, 1)

    def test_adjust_below_zero_is_rejected(self):
        with self.assertRaises(ValidationError):
            self.service.adjust("A-1", -3)
        self.assertEqual(self.store.saves, 0)

    def test_adjust_missing_sku(self):
        with self.assertRaises(NotFoundError):
            self.service.adjust("Z-9", 1)

    def test_warehouses_are_sorted_and_unique(self):
        self.assertEqual(self.service.warehouses(), ["ams", "berlin"])


if __name__ == "__main__":
    unittest.main()
