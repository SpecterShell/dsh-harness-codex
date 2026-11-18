The invoice migration only half landed. `build_invoice` now raises a TypeError,
quotes still work, and `NOTES.md` describes what was intended. A colleague saved
`migration.patch`, but it was written before the default tax rate changed, so it
no longer applies cleanly. Use it as a guide rather than applying it verbatim.

Finish the port. Invoices must use the order's tax rate when one is given and
fall back to 8.25% otherwise; quotes stay pre-tax. Don't touch
`billing/legacy.py`. Run the tests when you are done.
