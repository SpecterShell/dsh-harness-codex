"""The inventory item type."""

from dataclasses import dataclass

from .errors import ValidationError


@dataclass(frozen=True)
class Item:
    """One stock keeping unit in one warehouse."""

    sku: str
    name: str
    warehouse: str
    quantity: int
    reorder_point: int
    unit_cost_cents: int

    def __post_init__(self):
        for field in ("sku", "name", "warehouse"):
            value = getattr(self, field)
            if not isinstance(value, str) or not value.strip():
                raise ValidationError(f"{field} must be a non-empty string")
        for field in ("quantity", "reorder_point"):
            value = getattr(self, field)
            if not isinstance(value, int) or isinstance(value, bool):
                raise ValidationError(f"{field} must be an integer")
            if value < 0:
                raise ValidationError(f"{field} must not be negative")
        if not isinstance(self.unit_cost_cents, int) or isinstance(self.unit_cost_cents, bool):
            raise ValidationError("unit_cost_cents must be an integer")
        if self.unit_cost_cents <= 0:
            raise ValidationError("unit_cost_cents must be positive")

    @property
    def value_cents(self):
        """Total value of the stock on hand."""
        return self.quantity * self.unit_cost_cents

    @property
    def needs_reorder(self):
        """True when quantity is at or below the reorder point."""
        return self.quantity <= self.reorder_point

    @property
    def shortfall(self):
        """How many units are missing to reach the reorder point."""
        return max(0, self.reorder_point - self.quantity)

    def with_quantity(self, quantity):
        """Return a copy with a new quantity."""
        return Item(
            sku=self.sku,
            name=self.name,
            warehouse=self.warehouse,
            quantity=quantity,
            reorder_point=self.reorder_point,
            unit_cost_cents=self.unit_cost_cents,
        )

    @classmethod
    def from_dict(cls, data):
        """Build an item from a JSON object."""
        return cls(
            sku=data["sku"],
            name=data["name"],
            warehouse=data["warehouse"],
            quantity=data["quantity"],
            reorder_point=data["reorder_point"],
            unit_cost_cents=data["unit_cost_cents"],
        )

    def to_dict(self):
        """Return the JSON object for this item."""
        return {
            "sku": self.sku,
            "name": self.name,
            "warehouse": self.warehouse,
            "quantity": self.quantity,
            "reorder_point": self.reorder_point,
            "unit_cost_cents": self.unit_cost_cents,
        }
