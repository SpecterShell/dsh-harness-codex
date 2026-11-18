The ticket board needs a status filter. `python3 -m tickets.cli list` and
`python3 -m tickets.cli count` should accept `--status <value>` and restrict
their output to that status. Statuses live in `data/tickets.json`.

Without the flag, both commands must produce exactly what they produce today,
including the JSON field names and the file order. Add a test for the filter and
run the suite when you are done.
