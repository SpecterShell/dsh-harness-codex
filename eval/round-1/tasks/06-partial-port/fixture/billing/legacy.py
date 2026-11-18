"""Old billing total kept for the migration audit.

Nothing imports this module. Do not change it.
"""


def compute_total(items, tax_rate=0.0825):
    subtotal = sum(item["unit_price_cents"] * item["quantity"] for item in items)
    return round(subtotal * (1 + tax_rate))
