import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--before") {
      args.before = next;
      i++;
    } else if (arg === "--after") {
      args.after = next;
      i++;
    } else if (arg === "--out-dir") {
      args.outDir = next;
      i++;
    } else if (arg === "--target-ref") {
      args.targetRef = next;
      i++;
    } else if (arg === "--source-dir") {
      args.sourceDir = next;
      i++;
    } else if (arg === "--before-exit-code") {
      args.beforeExitCode = next;
      i++;
    } else if (arg === "--after-exit-code") {
      args.afterExitCode = next;
      i++;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function parseCsv(text) {
  if (!text.trim()) {
    return [];
  }

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [rawHeaders = [], ...data] = rows;
  const headers = rawHeaders.map((header) => header.replace(/^\uFEFF/, ""));
  return data
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function getValue(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      return String(row[name] ?? "");
    }
  }
  return "";
}

function normalizeLocation(value) {
  return String(value || "").replace(/\\/g, "/").replace(/:\d+(:\d+)?$/, "");
}

function toFinding(row) {
  const rule = getValue(row, ["Rule", "rule", "RuleName", "ruleName", "Rule Name"]);
  const severity = getValue(row, ["Severity", "severity"]);
  const message = getValue(row, ["Message", "message", "Description", "description"]);
  const location = getValue(row, ["Location", "location", "File", "file", "Source", "source"]);
  const normalizedLocation = normalizeLocation(location);

  return {
    key: `${severity}|${rule}|${normalizedLocation}|${message}`,
    severity,
    rule,
    message,
    location,
    normalizedLocation,
  };
}

function severityRank(severity) {
  const value = String(severity || "");
  if (/^\s*1\b|Critical/i.test(value)) return "critical";
  if (/^\s*2\b|High/i.test(value)) return "high";
  return "other";
}

function stats(findings) {
  return {
    total: findings.length,
    critical: findings.filter((finding) => severityRank(finding.severity) === "critical").length,
    high: findings.filter((finding) => severityRank(finding.severity) === "high").length,
  };
}

function escapeMd(value) {
  return String(value || "").replace(/\|/g, "/").replace(/\r?\n/g, " ");
}

function truncate(value, length = 140) {
  const text = escapeMd(value);
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function findingTable(items) {
  if (!items.length) {
    return "_None._";
  }

  return [
    "| Severity | Rule | Location | Message |",
    "| --- | --- | --- | --- |",
    ...items.slice(0, 10).map((item) =>
      `| ${escapeMd(item.severity)} | \`${escapeMd(item.rule)}\` | \`${escapeMd(item.location)}\` | ${truncate(item.message)} |`,
    ),
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const beforeRows = parseCsv(await readTextIfExists(args.before));
  const afterRows = parseCsv(await readTextIfExists(args.after));

  const beforeFindings = beforeRows.map(toFinding).filter((finding) => !/EngineError$/.test(finding.rule));
  const afterFindings = afterRows.map(toFinding).filter((finding) => !/EngineError$/.test(finding.rule));
  const before = stats(beforeFindings);
  const after = stats(afterFindings);

  const beforeKeys = new Map(beforeFindings.map((finding) => [finding.key, finding]));
  const afterKeys = new Map(afterFindings.map((finding) => [finding.key, finding]));
  const newFindings = afterFindings.filter((finding) => !beforeKeys.has(finding.key));
  const removedFindings = beforeFindings.filter((finding) => !afterKeys.has(finding.key));
  const newHighOrCritical = newFindings.filter((finding) => ["critical", "high"].includes(severityRank(finding.severity)));

  const delta = {
    total: after.total - before.total,
    critical: after.critical - before.critical,
    high: after.high - before.high,
    newFindings: newFindings.length,
    removedFindings: removedFindings.length,
    newHighOrCritical: newHighOrCritical.length,
  };

  const decision =
    newHighOrCritical.length > 0
      ? "NOT SAFE: new high or critical findings appeared after basic cleanup."
      : delta.total < 0
        ? "PROMISING: analyzer findings decreased and no new high/critical findings appeared."
        : "NEUTRAL: no analyzer improvement detected, but no new high/critical findings appeared.";

  const result = {
    before,
    after,
    delta,
    newFindings: newFindings.slice(0, 50),
    removedFindings: removedFindings.slice(0, 50),
    newHighOrCriticalFindings: newHighOrCritical.slice(0, 50),
    analyzerBeforeExitCode: args.beforeExitCode || "",
    analyzerAfterExitCode: args.afterExitCode || "",
    decision,
  };

  await fs.mkdir(args.outDir, { recursive: true });
  await fs.writeFile(path.join(args.outDir, "analyzer-comparison.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");

  const markdown = `# Basic Code Cleanup Analyzer Comparison

- Target ref: ${args.targetRef}
- Source directory: ${args.sourceDir}
- Analyzer before exit code: ${args.beforeExitCode || ""}
- Analyzer after exit code: ${args.afterExitCode || ""}

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Total findings | ${before.total} | ${after.total} | ${delta.total} |
| Critical findings | ${before.critical} | ${after.critical} | ${delta.critical} |
| High findings | ${before.high} | ${after.high} | ${delta.high} |
| New findings | 0 | ${delta.newFindings} | ${delta.newFindings} |
| Removed findings | ${delta.removedFindings} | 0 | -${delta.removedFindings} |
| New High/Critical findings | 0 | ${delta.newHighOrCritical} | ${delta.newHighOrCritical} |

## Decision

${decision}

## Removed Findings

${findingTable(removedFindings)}

## New Findings

${findingTable(newFindings)}

## New High/Critical Findings

${findingTable(newHighOrCritical)}
`;

  await fs.writeFile(path.join(args.outDir, "analyzer-comparison.md"), markdown, "utf8");
  await fs.writeFile(
    path.join(args.outDir, "comparison-summary.env"),
    [
      `total_before=${before.total}`,
      `total_after=${after.total}`,
      `total_delta=${delta.total}`,
      `fixed_findings=${delta.removedFindings}`,
      `new_findings=${delta.newFindings}`,
      `new_high_or_critical=${delta.newHighOrCritical}`,
    ].join("\n") + "\n",
    "utf8",
  );

  console.log(decision);
  console.log(`Fixed findings: ${delta.removedFindings}`);
  console.log(`New findings: ${delta.newFindings}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
