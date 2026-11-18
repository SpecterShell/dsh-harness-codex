/** Default client configuration. */
export const DEFAULTS = {
  retryCount: 3,
  timeoutMs: 5000,
  endpoint: 'https://notify.invalid'
}

/**
 * Merge user overrides over the defaults and validate the result.
 * @param {Record<string, unknown>} overrides
 */
export function loadConfig(overrides = {}) {
  const config = { ...DEFAULTS, ...overrides }

  if (!Number.isInteger(config.retryCount) || config.retryCount < 0) {
    throw new TypeError('retryCount must be a non-negative integer')
  }
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive integer')
  }
  if (typeof config.endpoint !== 'string' || config.endpoint.length === 0) {
    throw new TypeError('endpoint must be a non-empty string')
  }

  return config
}
