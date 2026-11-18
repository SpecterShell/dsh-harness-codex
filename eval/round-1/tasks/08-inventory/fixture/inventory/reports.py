"""Table formatting for the CLI."""


def format_cents(cents):
    """Format an integer number of cents as dollars."""
    return f"${cents / 100:,.2f}"


def _table(headers, rows):
    widths = [len(header) for header in headers]
    for row in rows:
        for index, cell in enumerate(row):
            widths[index] = max(widths[index], len(cell))

    def line(cells):
        return "  ".join(cell.ljust(widths[index]) for index, cell in enumerate(cells)).rstrip()

    lines = [line(headers), "  ".join("-" * width for width in widths)]
    lines.extend(line(row) for row in rows)
    return "\n".join(lines)


def render_items(items):
    """Render the full stock list."""
    headers = ["SKU", "NAME", "WAREHOUSE", "QTY", "REORDER", "VALUE"]
    rows = [
        [
            item.sku,
            item.name,
            item.warehouse,
            str(item.quantity),
            str(item.reorder_point),
            format_cents(item.value_cents),
        ]
        for item in items
    ]
    return _table(headers, rows)


def render_low_stock(items):
    """Render the reorder list."""
    headers = ["SKU", "NAME", "WAREHOUSE", "QTY", "REORDER", "SHORTFALL"]
    rows = [
        [
            item.sku,
            item.name,
            item.warehouse,
            str(item.quantity),
            str(item.reorder_point),
            str(item.shortfall),
        ]
        for item in items
    ]
    return _table(headers, rows)
