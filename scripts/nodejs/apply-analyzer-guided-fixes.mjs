import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (["--report", "--root", "--json", "--markdown"].includes(value)) {
      args[value.slice(2)] = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
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

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [rawHeaders = [], ...data] = rows;
  const headers = rawHeaders.map((header) => header.replace(/^\uFEFF/, ""));
  return data
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function value(row, name) {
  return String(row[name] ?? row[name.toLowerCase()] ?? "");
}

function resolveProjectFile(root, file) {
  const resolved = path.resolve(root, file.replace(/\\/g, "/"));
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Analyzer path is outside the project: ${file}`);
  }
  return resolved;
}

function replaceNearColumn(line, column, expected, replacement) {
  const preferred = Math.max(0, column - 1);
  if (line.slice(preferred, preferred + expected.length) === expected) {
    return `${line.slice(0, preferred)}${replacement}${line.slice(preferred + expected.length)}`;
  }

  const positions = [];
  let index = line.indexOf(expected);
  while (index !== -1) {
    positions.push(index);
    index = line.indexOf(expected, index + expected.length);
  }
  if (!positions.length) return null;

  positions.sort((left, right) => Math.abs(left - preferred) - Math.abs(right - preferred));
  const selected = positions[0];
  return `${line.slice(0, selected)}${replacement}${line.slice(selected + expected.length)}`;
}

function applyLocationFixes(content, fixes) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const hadFinalNewline = content.endsWith("\n");
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (hadFinalNewline) lines.pop();

  let applied = 0;
  for (const fix of [...fixes].sort((a, b) => b.line - a.line || b.column - a.column)) {
    const index = fix.line - 1;
    if (index < 0 || index >= lines.length) continue;
    const updated = replaceNearColumn(lines[index], fix.column, fix.expected, fix.replacement);
    if (updated === null || updated === lines[index]) continue;
    lines[index] = updated;
    applied++;
  }

  let output = lines.join("\n") + (hadFinalNewline ? "\n" : "");
  if (eol === "\r\n") output = output.replace(/\n/g, "\r\n");
  return { content: output, applied };
}

function applyBraceFixes(content, findings) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const hadFinalNewline = content.endsWith("\n");
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (hadFinalNewline) lines.pop();
  let applied = 0;

  const targetLines = [...new Set(findings.map((finding) => Number(value(finding, "startLine"))))].sort((a, b) => b - a);
  for (const targetLine of targetLines) {
    let ifIndex = targetLine - 1;
    if (!/^\s*if\s*\(/.test(lines[ifIndex] || "")) ifIndex--;
    if (ifIndex < 0) continue;

    const inline = lines[ifIndex].match(/^(\s*)(if\s*\([^\n]+?\))\s+([^{}]+;)\s*$/);
    if (inline) {
      lines.splice(ifIndex, 1, `${inline[1]}${inline[2]} {`, `${inline[1]}  ${inline[3].trim()}`, `${inline[1]}}`);
      applied++;
      continue;
    }

    if (!/^\s*if\s*\([^\n]+\)\s*$/.test(lines[ifIndex] || "")) continue;
    let bodyIndex = ifIndex + 1;
    while (bodyIndex < lines.length && !lines[bodyIndex].trim()) bodyIndex++;
    if (bodyIndex >= lines.length || /[{}]/.test(lines[bodyIndex]) || !/;\s*$/.test(lines[bodyIndex])) continue;

    const indent = (lines[ifIndex].match(/^\s*/) || [""])[0];
    lines[ifIndex] = `${lines[ifIndex].trimEnd()} {`;
    lines[bodyIndex] = `${indent}  ${lines[bodyIndex].trim()}`;
    lines.splice(bodyIndex + 1, 0, `${indent}}`);
    applied++;
  }

  let output = lines.join("\n") + (hadFinalNewline ? "\n" : "");
  if (eol === "\r\n") output = output.replace(/\n/g, "\r\n");
  return { content: output, applied };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root || ".");
  const rows = parseCsv(await fs.readFile(path.resolve(root, args.report), "utf8"));
  const byFile = new Map();

  for (const row of rows) {
    const file = value(row, "file");
    if (!file) continue;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(row);
  }

  const metrics = { sldsHooks: 0, apexAnnotations: 0, apexBraces: 0, changedFiles: 0 };
  const changedFiles = [];

  for (const [file, findings] of byFile) {
    const filePath = resolveProjectFile(root, file);
    let content = await fs.readFile(filePath, "utf8");
    const before = content;
    const locationFixes = [];

    for (const finding of findings) {
      const rule = value(finding, "rule");
      const message = value(finding, "message");
      const line = Number(value(finding, "startLine"));
      const column = Number(value(finding, "startColumn"));

      if (rule === "@salesforce-ux/slds/no-hardcoded-values-slds2") {
        const match = message.match(/Consider replacing the (.+?) static value[\s\S]*?:\s*(?:1\.\s*)?(--[\w-]+)/);
        if (match) {
          locationFixes.push({ line, column, expected: match[1], replacement: `var(${match[2]}, ${match[1]})`, type: "slds" });
        }
      } else if (rule === "AnnotationsNamingConventions") {
        const match = message.match(/annotation\s+(@[\w]+).*?:\s+(@[\w]+)/i);
        if (match) locationFixes.push({ line, column, expected: match[1], replacement: match[2], type: "annotation" });
      }
    }

    for (const fix of locationFixes) {
      const result = applyLocationFixes(content, [fix]);
      if (result.applied) {
        content = result.content;
        if (fix.type === "slds") metrics.sldsHooks++;
        if (fix.type === "annotation") metrics.apexAnnotations++;
      }
    }

    const braceFindings = findings.filter((finding) =>
      ["IfStmtsMustUseBraces", "IfElseStmtsMustUseBraces"].includes(value(finding, "rule")),
    );
    if (braceFindings.length) {
      const result = applyBraceFixes(content, braceFindings);
      content = result.content;
      metrics.apexBraces += result.applied;
    }

    if (content !== before) {
      await fs.writeFile(filePath, content, "utf8");
      metrics.changedFiles++;
      changedFiles.push(file.replace(/\\/g, "/"));
    }
  }

  const report = { ...metrics, totalFixes: metrics.sldsHooks + metrics.apexAnnotations + metrics.apexBraces, changedFilesList: changedFiles };
  const jsonPath = path.resolve(root, args.json);
  const markdownPath = path.resolve(root, args.markdown);
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.mkdir(path.dirname(markdownPath), { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(
    markdownPath,
    `# Analyzer-guided fixes\n\n- Total fixes: **${report.totalFixes}**\n- SLDS hooks with fallback: **${report.sldsHooks}**\n- Apex annotations normalized: **${report.apexAnnotations}**\n- Apex brace fixes: **${report.apexBraces}**\n- Files changed: **${report.changedFiles}**\n`,
    "utf8",
  );
  console.log(`Analyzer-guided safe fixes applied: ${report.totalFixes}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

export { applyBraceFixes, applyLocationFixes, parseCsv, replaceNearColumn, resolveProjectFile };
