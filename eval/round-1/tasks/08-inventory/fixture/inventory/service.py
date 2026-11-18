"""Operations the CLI exposes."""

from .errors import NotFoundError, ValidationError


class InventoryService:
    """Inventory queries and updates over a store."""

    def __init__(self, store):
        self.store = store

    def list_items(self):
        """Every item, sorted by SKU."""
        return sorted(self.store.load(), key=lambda item: item.sku)

    def low_stock(self):
        """Items at or below their reorder point, sorted by SKU."""
        return sorted(
            (item for item in self.store.load() if item.needs_reorder),
            key=lambda item: item.sku,
        )

    def get_item(self, sku):
        """Return one item or raise NotFoundError."""
        for item in self.store.load():
            if item.sku == sku:
                return item
        raise NotFoundError(sku)

    def total_value(self):
        """Total value of every item in the store."""
        return sum(item.value_cents for item in self.store.load())

    def adjust(self, sku, delta):
        """Change one item's quantity by delta and save the file."""
        items = self.store.load()
        for index, item in enumerate(items):
            if item.sku != sku:
                continue
            quantity = item.quantity + delta
            if quantity < 0:
                raise ValidationError(
                    f"adjusting {sku} by {delta} would leave {quantity} units"
                )
            updated = item.with_quantity(quantity)
            items[index] = updated
            self.store.save(items)
            return updated
        raise NotFoundError(sku)

    def warehouses(self):
        """Sorted warehouse names present in the store."""
        return sorted({item.warehouse for item in self.store.load()})
