"""Totals shared by invoices and quotes."""

DEFAULT_TAX_RATE = 0.0825


def compute_total(items, include_tax=True):
    """Return the total for order items, optionally including tax."""
    subtotal = sum(item["unit_price_cents"] * item["quantity"] for item in items)
    if include_tax:
        return round(subtotal * (1 + DEFAULT_TAX_RATE))
    return subtotal
