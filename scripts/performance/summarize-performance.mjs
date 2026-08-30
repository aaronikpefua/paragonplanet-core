import fs from "node:fs";
import readline from "node:readline";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: node scripts/performance/summarize-performance.mjs <log-file>");
  process.exit(1);
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart));
      return parsed.event ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function summary(rows) {
  const durations = rows.map((row) => Number(row.durationMs)).filter((value) => Number.isFinite(value));
  const statuses = rows.map((row) => Number(row.statusCode || 0));
  return {
    count: rows.length,
    success: rows.filter((row) => row.status === "success" || (Number(row.statusCode) > 0 && Number(row.statusCode) < 400)).length,
    failure: rows.filter((row) => row.status === "failure" || Number(row.statusCode) >= 400).length,
    rateLimit429: statuses.filter((status) => status === 429).length,
    server5xx: statuses.filter((status) => status >= 500).length,
    min: durations.length ? Math.min(...durations) : 0,
    max: durations.length ? Math.max(...durations) : 0,
    average: durations.length ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 100) / 100 : 0,
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
  };
}

const groups = new Map();
const rl = readline.createInterface({
  input: fs.createReadStream(inputPath, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  const event = parseLine(line);
  if (!event) continue;
  const key = [event.event, event.domain || event.platform || "unknown", event.operation || event.route || "unknown"].join(" | ");
  const rows = groups.get(key) || [];
  rows.push(event);
  groups.set(key, rows);
}

const output = [...groups.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, rows]) => ({ key, ...summary(rows) }));

console.log(JSON.stringify({
  source: inputPath,
  generatedAt: new Date().toISOString(),
  groups: output,
}, null, 2));
