# Pipeline layout

`src/cli.js` parses arguments, `src/commands/*` render or write output, and
`src/core/*` holds the data logic. `src/lib/csv.js` is a quote-aware parser so
region names may contain commas.

`loadRows` normalises and validates every row before any command sees it. A
validation error aborts the command with exit code 2.

The legacy module is not imported anywhere. It is kept so the 2018 numbers can
be reproduced from the same CSV.
