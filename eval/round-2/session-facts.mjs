#!/usr/bin/env node
// Print the facts a round-2 run is scored on, from one DSH session log.
//
// Usage:
//   node eval/round-2/session-facts.mjs <session-log-or-session-dir> [--json]
//
// A session log is the `session.v4.jsonl.zstd` file inside
// `$DSH_HOME/sessions/<workspace-key>/session-<uuid>/`. Plain `.jsonl` and
// `.zst` files are accepted too, as is the session directory or the workspace
// key directory (the most recently modified log below it is used).
//
// The fields, and where they come from in the log:
//
//   session      `type:"session"`            `id`, `cwd`, `createdAt`
//   provider     last `type:"request/header"` `data.header.config.provider`
//   model        same event                   `data.header.config.model`
//   effort       same event                   `data.header.config.reasoningEffort`
//   preset       last `type:"agent-preset/selected"` `data.agentPreset`, else
//                the initial `agentPreset` on the `session` event
//   access mode  last `type:"sandbox/mode"` `data.mode`
//   turns        highest `data.turn` on `type:"turn/end"` events
//   tools        one count per `type:"tool/call"` `data.name`
//   tokens       sum of `data.usage.inputTokens` and
//                `data.usage.outputTokens` over `type:"assistant/message"`
//                events (one usage record per model step)
//
// The header is written once per turn, so a run with a follow-up has two
// `request/header` events. All of them must agree on provider, model and
// effort; this script reports the last one and marks a disagreement as
// `headerMismatch: true`, which a scored run must not have.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { zstdDecompressSync } from "node:zlib";

function findLog(target) {
  const path = resolve(target);
  const stat = statSync(path);
  if (stat.isFile()) return path;
  const candidates = [];
  for (const entry of readdirSync(path)) {
    const child = join(path, entry);
    const childStat = statSync(child);
    if (childStat.isFile() && /\.jsonl(\.zstd|\.zst)?$/.test(entry)) {
      candidates.push(child);
    } else if (childStat.isDirectory()) {
      for (const inner of readdirSync(child)) {
        const file = join(child, inner);
        if (/\.jsonl(\.zstd|\.zst)?$/.test(inner) && statSync(file).isFile()) {
          candidates.push(file);
        }
      }
    }
  }
  if (candidates.length === 0) {
    throw new Error(`no session log under ${path}`);
  }
  candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  // A workspace often holds a tiny aborted session next to the real run.
  // Prefer the newest log that actually contains a model request.
  for (const candidate of candidates) {
    try {
      if (readEvents(candidate).some((event) => event.type === "request/header")) {
        return candidate;
      }
    } catch {
      // Fall through to the next candidate; the chosen log reports parse errors.
    }
  }
  return candidates[0];
}

function readEvents(file) {
  let raw = readFileSync(file);
  if (file.endsWith(".zstd") || file.endsWith(".zst")) {
    if (typeof zstdDecompressSync !== "function") {
      throw new Error("this Node build has no zstd support; use .jsonl or a newer Node");
    }
    raw = zstdDecompressSync(raw);
  }
  return raw
    .toString("utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`line ${index + 1} is not JSON: ${error.message}`);
      }
    });
}

function describePreset(raw) {
  if (raw === "codex-inspired") return "Codex-inspired";
  if (raw === "standard") return "Standard";
  return raw ?? "unknown";
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const target = args.find((arg) => !arg.startsWith("--"));
  if (!target) {
    process.stderr.write(
      "usage: session-facts.mjs <session-log-or-session-dir> [--json]\n",
    );
    process.exit(2);
  }

  const file = findLog(target);
  const events = readEvents(file);
  const session = events.find((event) => event.type === "session") ?? {};
  const headers = events.filter((event) => event.type === "request/header");
  const presets = events
    .filter((event) => event.type === "agent-preset/selected")
    .map((event) => event.data?.agentPreset);
  const accessMode = events
    .filter((event) => event.type === "sandbox/mode")
    .at(-1)?.data?.mode;

  const conflicts = [];
  for (const event of headers) {
    const config = event.data?.header?.config ?? {};
    const triple = [config.provider, config.model, config.reasoningEffort];
    if (conflicts.length === 0) conflicts.push(triple);
    else if (conflicts[0].join("|") !== triple.join("|")) conflicts.push(triple);
  }
  const config = headers.at(-1)?.data?.header?.config ?? {};
  const finalPreset = presets.at(-1) ?? session.agentPreset;

  const toolCounts = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let steps = 0;
  let turns = 0;
  const turnStarts = new Map();

  for (const event of events) {
    if (event.type === "tool/call") {
      const name = event.data?.name ?? "unknown";
      toolCounts[name] = (toolCounts[name] ?? 0) + 1;
    } else if (event.type === "assistant/message") {
      steps += 1;
      const usage = event.data?.usage ?? {};
      inputTokens += usage.inputTokens ?? 0;
      outputTokens += usage.outputTokens ?? 0;
      totalTokens += usage.totalTokens ?? 0;
    } else if (event.type === "turn/end") {
      turns = Math.max(turns, event.data?.turn ?? 0);
    } else if (event.type === "turn/start") {
      turnStarts.set(event.data?.turn, event.time);
    }
  }

  const lastEnd = events.filter((event) => event.type === "turn/end").at(-1);
  const firstStart = events.find((event) => event.type === "turn/start");
  const wallMs =
    firstStart && lastEnd ? Math.max(0, lastEnd.time - firstStart.time) : null;

  const result = {
    log: file,
    sessionId: session.id ?? basename(dirname(file)),
    cwd: session.cwd ?? "unknown",
    provider: config.provider ?? "unknown",
    model: config.model ?? "unknown",
    effort: config.reasoningEffort ?? "unknown",
    preset: describePreset(finalPreset),
    presetRaw: finalPreset ?? "unknown",
    accessMode: accessMode ?? "unknown",
    turns,
    steps,
    headerCount: headers.length,
    headerMismatch: conflicts.length > 1,
    toolCalls: toolCounts,
    toolCallTotal: Object.values(toolCounts).reduce((a, b) => a + b, 0),
    inputTokens,
    outputTokens,
    totalTokens,
    wallMs,
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(
    [
      `log             ${result.log}`,
      `session         ${result.sessionId}`,
      `cwd             ${result.cwd}`,
      `provider        ${result.provider}`,
      `model           ${result.model}`,
      `effort          ${result.effort}`,
      `preset          ${result.preset} (${result.presetRaw})`,
      `access mode     ${result.accessMode}`,
      `turns           ${result.turns}`,
      `model steps     ${result.steps}`,
      `headers         ${result.headerCount}${result.headerMismatch ? " (MISMATCH)" : ""}`,
      `tool calls      ${result.toolCallTotal}`,
      ...Object.entries(result.toolCalls)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => `  ${name.padEnd(14)}${count}`),
      `input tokens    ${result.inputTokens}`,
      `output tokens   ${result.outputTokens}`,
      `total tokens    ${result.totalTokens}`,
      `wall ms         ${result.wallMs ?? "unknown"}`,
    ].join("\n") + "\n",
  );
}

main();
