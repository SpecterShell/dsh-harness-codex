/** Daily report aggregation. */

/**
 * Format a date as YYYY-MM-DD.
 * @param {Date | string} value
 */
export function formatDate(value) {
  return new Date(value).toISOString().slice(0, 10)
}

/**
 * Sum order totals per day.
 * @param {{ createdAt: Date | string, totalCents: number }[]} rows
 */
export function dailySummary(rows) {
  const byDay = new Map()
  for (const row of rows) {
    const day = formatDate(row.createdAt)
    byDay.set(day, (byDay.get(day) ?? 0) + row.totalCents)
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, totalCents]) => ({ date, totalCents }))
}
