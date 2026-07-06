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
    } else if (arg === "--target-api") {
      args.targetApi = next;
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
    apiVersionRelated: /api\s*version|apiVersion|sourceApiVersion/i.test(`${rule} ${message}`),
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
    apiVersionRelated: findings.filter((finding) => finding.apiVersionRelated).length,
  };
}

function countBy(items, property) {
  const counts = new Map();
  for (const item of items) {
    const key = String(item[property] || "(empty)");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function topDelta(beforeCounts, afterCounts, improved) {
  const keys = new Set([...beforeCounts.keys(), ...afterCounts.keys()]);
  return [...keys]
    .map((name) => {
      const before = beforeCounts.get(name) || 0;
      const after = afterCounts.get(name) || 0;
      return { name, before, after, delta: after - before };
    })
    .filter((row) => (improved ? row.delta < 0 : row.delta > 0))
    .sort((a, b) => (improved ? a.delta - b.delta : b.delta - a.delta))
    .slice(0, 10);
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

function deltaTable(items) {
  if (!items.length) {
    return "_None._";
  }

  return [
    "| Name | Before | After | Delta |",
    "| --- | ---: | ---: | ---: |",
    ...items.map((item) => `| \`${escapeMd(item.name)}\` | ${item.before} | ${item.after} | ${item.delta} |`),
  ].join("\n");
}

function htmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    apiVersionRelated: after.apiVersionRelated - before.apiVersionRelated,
    newFindings: newFindings.length,
    removedFindings: removedFindings.length,
    newHighOrCritical: newHighOrCritical.length,
  };

  const ruleImprovements = topDelta(countBy(beforeFindings, "rule"), countBy(afterFindings, "rule"), true);
  const ruleRegressions = topDelta(countBy(beforeFindings, "rule"), countBy(afterFindings, "rule"), false);
  const fileImprovements = topDelta(countBy(beforeFindings, "normalizedLocation"), countBy(afterFindings, "normalizedLocation"), true);
  const fileRegressions = topDelta(countBy(beforeFindings, "normalizedLocation"), countBy(afterFindings, "normalizedLocation"), false);

  const decision =
    newHighOrCritical.length > 0
      ? "NOT SAFE: new high or critical findings appeared after the API version update."
      : delta.apiVersionRelated < 0
        ? "PROMISING: API version related findings decreased and no new high/critical findings appeared."
        : "NEUTRAL: no API version related improvement detected, but no new high/critical findings appeared.";

  const result = {
    before,
    after,
    delta,
    newFindings: newFindings.slice(0, 50),
    removedFindings: removedFindings.slice(0, 50),
    newHighOrCriticalFindings: newHighOrCritical.slice(0, 50),
    ruleImprovements,
    ruleRegressions,
    fileImprovements,
    fileRegressions,
    analyzerBeforeExitCode: args.beforeExitCode || "",
    analyzerAfterExitCode: args.afterExitCode || "",
    decision,
  };

  await fs.mkdir(args.outDir, { recursive: true });
  await fs.writeFile(path.join(args.outDir, "analyzer-comparison.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");

  const markdown = `# API Version Upgrade Analyzer Comparison

- Target API version: ${args.targetApi}
- Target ref: ${args.targetRef}
- Source directory: ${args.sourceDir}
- Analyzer before exit code: ${args.beforeExitCode || ""}
- Analyzer after exit code: ${args.afterExitCode || ""}

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Total findings | ${before.total} | ${after.total} | ${delta.total} |
| Critical findings | ${before.critical} | ${after.critical} | ${delta.critical} |
| High findings | ${before.high} | ${after.high} | ${delta.high} |
| API version related findings | ${before.apiVersionRelated} | ${after.apiVersionRelated} | ${delta.apiVersionRelated} |
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

## Rules Improved

${deltaTable(ruleImprovements)}

## Rules Regressed

${deltaTable(ruleRegressions)}

## Files Improved

${deltaTable(fileImprovements)}

## Files Regressed

${deltaTable(fileRegressions)}
`;

  await fs.writeFile(path.join(args.outDir, "analyzer-comparison.md"), markdown, "utf8");

  const statusClass = newHighOrCritical.length > 0 ? "warn" : "ok";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>API Version Upgrade Summary</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; background: #f8fafc; }
    main { max-width: 1120px; margin: 0 auto; background: white; border: 1px solid #d9e1ec; border-radius: 8px; padding: 24px; }
    h1, h2 { margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; }
    th, td { border: 1px solid #d9e1ec; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #eef2f7; }
    code { background: #eef2f7; padding: 1px 5px; border-radius: 4px; }
    .ok { color: #2e844a; font-weight: 700; }
    .warn { color: #b45f06; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>API Version Upgrade Summary</h1>
    <p><strong>Target API:</strong> <code>${htmlEscape(args.targetApi)}</code> | <strong>Target ref:</strong> <code>${htmlEscape(args.targetRef)}</code></p>
    <h2>Analyzer Delta</h2>
    <table>
      <tr><th>Metric</th><th>Before</th><th>After</th><th>Delta</th></tr>
      <tr><td>Total</td><td>${before.total}</td><td>${after.total}</td><td>${delta.total}</td></tr>
      <tr><td>Critical</td><td>${before.critical}</td><td>${after.critical}</td><td>${delta.critical}</td></tr>
      <tr><td>High</td><td>${before.high}</td><td>${after.high}</td><td>${delta.high}</td></tr>
      <tr><td>API version related</td><td>${before.apiVersionRelated}</td><td>${after.apiVersionRelated}</td><td>${delta.apiVersionRelated}</td></tr>
      <tr><td>New High/Critical</td><td>0</td><td>${delta.newHighOrCritical}</td><td>${delta.newHighOrCritical}</td></tr>
    </table>
    <p class="${statusClass}">${htmlEscape(decision)}</p>
  </main>
</body>
</html>
`;

  await fs.writeFile(path.join(args.outDir, "api-version-upgrade-summary.html"), html, "utf8");
  await fs.writeFile(
    path.join(args.outDir, "comparison-summary.env"),
    [
      `total_before=${before.total}`,
      `total_after=${after.total}`,
      `total_delta=${delta.total}`,
      `fixed_findings=${delta.removedFindings}`,
      `new_findings=${delta.newFindings}`,
      `new_high_or_critical=${delta.newHighOrCritical}`,
      `api_version_before=${before.apiVersionRelated}`,
      `api_version_after=${after.apiVersionRelated}`,
      `api_version_fixed=${Math.max(0, before.apiVersionRelated - after.apiVersionRelated)}`,
    ].join("\n") + "\n",
    "utf8",
  );

  console.log(decision);
  console.log(`Fixed findings: ${delta.removedFindings}`);
  console.log(`New findings: ${delta.newFindings}`);
  console.log(`API version findings fixed: ${Math.max(0, before.apiVersionRelated - after.apiVersionRelated)}`);

  if (newHighOrCritical.length > 0) {
    console.warn("New high or critical findings appeared after the API version update. Check the report before applying the patch.");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
