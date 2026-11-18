import { loadRows } from "./core/pipeline.js";
import { runReport } from "./commands/report.js";
import { writeExport } from "./commands/export.js";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { data: "data/sales.csv", out: null, groupBy: null };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--data") options.data = rest[++index];
    else if (arg === "--out") options.out = rest[++index];
    else if (arg === "--group-by") options.groupBy = rest[++index];
    else throw new Error(`unknown argument: ${arg}`);
  }
  return { command, options };
}

export function main(argv) {
  const { command, options } = parseArgs(argv);
  const rows = loadRows(options.data);
  if (command === "report") {
    runReport({ rows, groupBy: options.groupBy });
  } else if (command === "export") {
    if (!options.out) throw new Error("export needs --out");
    writeExport(rows, options.out, { groupBy: options.groupBy });
  } else {
    throw new Error(`unknown command: ${command}`);
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 2;
}
