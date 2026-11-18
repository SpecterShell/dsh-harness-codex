# ledger reconcile

`ledger.reconcile.reconcile(rows)` groups transactions by account and returns

```
{account: {"total_cents": int, "count": int}}
```

in account-name order (ascending, plain string order). `count` is the number of
distinct transactions. A row whose `transaction_id` was already seen is a retry
and is ignored, first occurrence wins.

`data/transactions.csv` is a small sample. The production export has the same
columns but far more rows.
