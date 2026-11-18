# Runbook

1. Confirm the log has today's date: `tail -1 logs/service.log`.
2. Run `python3 -m ops.report --log logs/service.log --out out/report.json`.
3. Check `total_failures` against the previous night. A jump larger than 20%
   usually means a producer changed the log format; inspect the last few lines
   rather than reading the file.
4. Ship `out/report.json` to the reporting bucket.

The log rotates daily and can reach tens of megabytes. Use `grep`, `awk` or a
streaming Python loop; do not check the whole file into the prompt.
