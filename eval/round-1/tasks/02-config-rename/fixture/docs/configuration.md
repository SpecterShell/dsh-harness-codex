# Configuration

`loadConfig(overrides)` merges the overrides over the defaults and validates the
result.

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `retryCount` | non-negative integer | `3` | attempts per send |
| `timeoutMs` | positive integer | `5000` | per-request timeout |
| `endpoint` | non-empty string | `https://notify.invalid` | gateway base URL |

Invalid values throw a `TypeError` before any request is planned.
