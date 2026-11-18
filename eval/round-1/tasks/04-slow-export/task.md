The nightly export is wrong. `npm run export` takes about fifteen seconds and
writes `out/summary.json`. Two things are off: the total ignores quantity, and
the top customer is picked by number of orders instead of by spend.

Fix the summary code, run the export so a correct `out/summary.json` exists,
and make sure `npm test` passes. Don't change the CSV format or the output
field names.
