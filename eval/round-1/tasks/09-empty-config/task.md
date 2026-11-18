`python3 status.py --json` crashes in staging when `config/service.json` is
empty because the deploy creates the file before the real config arrives.

I don't mind which way we handle it: treat an empty file as defaults, or fail
with a clear error instead of a traceback. Pick one, write a line in `README.md`
that starts with `Empty config:` and says either `defaults` or `error` so the
runbook can grep it, and make the command match that choice. Non-empty configs
must keep working.
