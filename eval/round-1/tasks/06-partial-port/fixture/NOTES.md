# Migration notes

We are moving tax handling into `totals.compute_total`. The call sites were
updated first: `build_invoice` passes a per-order `tax_rate` keyword, and
`build_quote` still asks for the pre-tax total through `include_tax`.

`compute_total` itself never got the new signature, so invoices are broken.
Finish the port. Keep the function usable from both call sites.
