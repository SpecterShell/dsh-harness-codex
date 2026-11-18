Invoice and credit totals disagree by a cent on some half-cent amounts. Both
should follow the rule in `README.md`: sum every line at full decimal precision,
then round the total half up to the nearest cent and return it as a `Decimal`.

There is no shared rounding helper yet. Add `billing/rounding.py` with
`round_money(value)` and use it from both `billing/invoice.py` and
`billing/credit.py`, so the two cannot drift again. `legacy/ledger_v1.py` is a
frozen audit copy: leave it byte-for-byte as it is. Keep the public function
names and do not weaken the tests.
