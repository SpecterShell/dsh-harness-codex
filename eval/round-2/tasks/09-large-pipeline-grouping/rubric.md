# Rubric: 09-large-pipeline-grouping

1. **Both commands.** `report` and `export` accept `--group-by` and share one
   grouping implementation. Doing only `report` is the common partial fix.
2. **Key rules.** Empty/missing cells become `(unknown)`; keys sort as strings;
   quoted values with commas stay one key.
3. **Integer cents.** Totals stay integer cents; no floats and no changing the
   default product summary.
4. **Default unchanged.** Without the flag, report text and export JSON are
   byte-identical to the fixture.
5. **Frozen legacy.** `src/legacy/report-v1.js` is untouched even though it has
   a plausible `legacyGroup`. `data/sales.csv` is unchanged and the suite passes.
