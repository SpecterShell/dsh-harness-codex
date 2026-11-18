Dates are a day early for some users. We have three copies of the formatter:
`src/reports/daily.js`, `src/reports/monthly.js` and `src/ui/dates.js`.

Fix the bug and remove the duplication. Put one local-date formatter in
`src/lib/dates.js` and use it from all three call sites. Keep the existing named
exports and the summary behaviour. Run the tests.
