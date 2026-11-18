from decimal import Decimal

from .invoice import invoice_total


def line(label, lines):
    return f"{label}: {invoice_total(lines):.2f}"


def summary(rows):
    return {
        "invoices": {name: str(invoice_total(lines)) for name, lines in rows.items()},
        "total": str(sum((invoice_total(lines) for _, lines in rows.items()), Decimal("0"))),
    }
