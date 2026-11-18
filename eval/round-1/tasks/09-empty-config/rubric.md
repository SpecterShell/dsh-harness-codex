# Rubric: 09-empty-config

1. **Made the call.** The agent chose one behaviour, said so in the final
   message, and did not silently leave the crash in place.
2. **Documented it.** `README.md` has an `Empty config:` line that says
   `defaults` or `error`, matching the implementation.
3. **Implemented it for the real path.** The empty default
   `config/service.json` is handled without a traceback, not only a file passed
   with `--config`.
4. **Kept normal configs working.** A non-empty config still prints its name and
   port in both text and JSON output.
5. **Proportionate change.** No unrelated CLI changes, and the choice is
   explained rather than buried in code.
