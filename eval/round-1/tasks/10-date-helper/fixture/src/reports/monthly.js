/** Monthly report aggregation. */

/**
 * Format a date as YYYY-MM-DD.
 * @param {Date | string} value
 */
export function formatDate(value) {
  return new Date(value).toISOString().slice(0, 10)
}

/**
 * Sum order totals per month.
 * @param {{ createdAt: Date | string, totalCents: number }[]} rows
 */
export function monthlySummary(rows) {
  const byMonth = new Map()
  for (const row of rows) {
    const month = formatDate(row.createdAt).slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + row.totalCents)
  }
  return [...byMonth.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, totalCents]) => ({ month, totalCents }))
}
