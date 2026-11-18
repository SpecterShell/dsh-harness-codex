/** Date labels for the dashboard. */

/**
 * Format a date as YYYY-MM-DD.
 * @param {Date | string} value
 */
export function formatDate(value) {
  return new Date(value).toISOString().slice(0, 10)
}

/**
 * Format a date for the compact table view.
 * @param {Date | string} value
 */
export function shortDate(value) {
  return formatDate(value).replaceAll('-', '/')
}
