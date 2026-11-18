# Billing totals

`billing.invoice.invoice_total(lines)` and `billing.credit.credit_total(lines)`
take a list of `(amount, quantity)` pairs. `amount` is a string or `Decimal`,
`quantity` an int.

Finance rule: sum every line at full decimal precision, then round the total
half up to the nearest cent (`ROUND_HALF_UP`, ties away from zero). Return a
`Decimal` quantised to two places.

`legacy/ledger_v1.py` is the frozen copy of the old invoicing code. It is kept
for audit only and must not change.
