import { loadConfig } from './config.js'

/** Builds request plans. Sending is handled by the caller. */
export class Client {
  constructor(overrides = {}) {
    this.config = loadConfig(overrides)
  }

  /**
   * Describe the request that would be sent for a payload.
   * @param {unknown} payload
   */
  plan(payload) {
    return {
      url: this.config.endpoint,
      attempts: this.config.retryCount,
      timeoutMs: this.config.timeoutMs,
      payload
    }
  }
}
