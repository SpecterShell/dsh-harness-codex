def reconcile(rows):
    accounts = {row["account"] for row in rows}
    result = {}
    for account in accounts:
        group = [row for row in rows if row["account"] == account]
        result[account] = {
            "total_cents": sum(row["amount_cents"] for row in group),
            "count": len(group),
        }
    return result
