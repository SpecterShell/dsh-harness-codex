# ticketctl

Small issue tracker CLI backed by `data/tickets.json`.

```
python3 -m tickets.cli list [--assignee NAME] [--json]
python3 -m tickets.cli count [--assignee NAME] [--json]
python3 -m tickets.cli show TICKET_ID
```

`list --json` prints the tickets in file order. `count` prints `N tickets`, or
`{"count": N}` with `--json`.

Status values come from an external board export and are not normalised: expect
mixed case and leading or trailing spaces in `data/tickets.json`.
