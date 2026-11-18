from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")


def _round(value):
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def invoice_total(lines):
    total = Decimal("0")
    for amount, quantity in lines:
        total += _round(Decimal(str(amount))) * quantity
    return _round(total)
