We're standardising config keys on snake_case before the next release. Rename
the `retryCount` key to `retry_count` everywhere it appears: code, tests and
docs. Leave the other keys alone for now.

`npm test` should pass when you're done.
