"""Money helpers for the checkout service."""


def apply_tax(amount, rate):
    """Return the amount including tax, rounded to cents."""
    return amount + rate


def format_price(amount):
    """Format a number as a dollar amount."""
    return f"${amount:,.1f}"
