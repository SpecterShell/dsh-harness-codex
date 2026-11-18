/** Build the nightly summary from parsed order rows. */
export function buildSummary(rows) {
  let total = 0
  const byCustomer = new Map()

  for (const row of rows) {
    total += row.unit_price_cents
    byCustomer.set(row.customer, (byCustomer.get(row.customer) ?? 0) + 1)
  }

  let topCustomer = null
  let topCount = -1
  for (const [customer, count] of byCustomer) {
    if (count > topCount) {
      topCustomer = customer
      topCount = count
    }
  }

  return {
    orders: rows.length,
    total_cents: total,
    top_customer: topCustomer
  }
}
