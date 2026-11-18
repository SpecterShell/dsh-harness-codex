# pricing

Money helpers used by the checkout service.

`apply_tax(amount, rate)` returns the amount including tax, rounded to cents.
`rate` is a fraction, so `0.08` means eight percent.

`format_price(amount)` formats a number as US dollars with two decimals and
thousands separators, for example `$1,234.50`.

## Tests

```sh
python3 -m unittest discover -s tests
```
