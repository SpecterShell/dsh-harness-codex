"""Error types shared by the inventory modules."""


class InventoryError(Exception):
    """Base class for errors the CLI reports without a traceback."""


class ValidationError(InventoryError):
    """An item or an adjustment is not valid."""


class NotFoundError(InventoryError):
    """A SKU is not in the data file."""

    def __init__(self, sku):
        super().__init__(f"unknown sku: {sku}")
        self.sku = sku


class StorageError(InventoryError):
    """The data file is missing, unreadable or malformed."""
