"""Quotes, which never include tax."""

from .totals import compute_total


def build_quote(order):
    """Build a pre-tax quote."""
    total = compute_total(order["items"], include_tax=False)
    return {"order_id": order["order_id"], "total_cents": total}
