Reviewer feedback: statuses are typed by hand in the source systems, so the
filter must ignore case and surrounding spaces. It must also accept several
statuses separated by commas, for example `--status open,blocked`, and match
tickets in any of them.

Keep the no-flag output unchanged. Add the extra cases to the tests.
