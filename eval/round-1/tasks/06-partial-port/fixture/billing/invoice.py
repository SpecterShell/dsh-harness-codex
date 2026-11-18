"""Invoice documents."""

from .totals import DEFAULT_TAX_RATE, compute_total


def build_invoice(order):
    """Build an invoice whose total includes tax."""
    rate = order.get("tax_rate", DEFAULT_TAX_RATE)
    total = compute_total(order["items"], tax_rate=rate)
    return {"order_id": order["order_id"], "total_cents": total}
