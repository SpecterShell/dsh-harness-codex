"""Hidden behaviour check for task 02. Run with the repository as cwd."""
from decimal import Decimal

from billing.credit import credit_total
from billing.invoice import invoice_total
from billing.rounding import round_money

CASES = [
    ("1.005", "1.01"),
    ("2.675", "2.68"),
    ("0.105", "0.11"),
    ("-1.005", "-1.01"),
    ("123456789.995", "123456790.00"),
    ("0", "0.00"),
]
for raw, expected in CASES:
    got = round_money(Decimal(raw))
    assert isinstance(got, Decimal), (raw, type(got))
    assert got == Decimal(expected), (raw, got, expected)
    assert got.as_tuple().exponent == -2, (raw, got)

for fn in (invoice_total, credit_total):
    assert fn([]) == Decimal("0.00"), (fn.__name__, fn([]))
    assert isinstance(fn([("1.00", 1)]), Decimal), fn.__name__
    assert fn([("1.005", 1)]) == Decimal("1.01"), (fn.__name__, fn([("1.005", 1)]))
    # Two half-cent lines must sum before rounding, not round per line.
    assert fn([("1.005", 1), ("1.005", 1)]) == Decimal("2.01"), (
        fn.__name__,
        fn([("1.005", 1), ("1.005", 1)]),
    )
    assert fn([("0.005", 1), ("0.005", 1), ("0.005", 1)]) == Decimal("0.02"), fn.__name__
    assert fn([("2.675", 3)]) == Decimal("8.03"), (fn.__name__, fn([("2.675", 3)]))
    assert fn([("-1.005", 2)]) == Decimal("-2.01"), (fn.__name__, fn([("-1.005", 2)]))
    assert fn([("123456789.995", 1)]) == Decimal("123456790.00"), fn.__name__
print("hidden money checks ok")
