import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const TEXT_EXTENSIONS = new Set([
  ".apex",
  ".cls",
  ".component",
  ".css",
  ".email",
  ".html",
  ".js",
  ".json",
  ".md",
  ".page",
  ".profile",
  ".svg",
  ".trigger",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

function parseArgs(argv) {
  const args = {
    sourceDir: "force-app",
    report: "docs/basic-code-cleanup-guard/basic-code-cleanup-report.md",
    json: "docs/basic-code-cleanup-guard/basic-code-cleanup-report.json",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--source-dir") {
      args.sourceDir = next;
      i++;
    } else if (arg === "--report") {
      args.report = next;
      i++;
    } else if (arg === "--json") {
      args.json = next;
      i++;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
node scripts/nodejs/basic-code-cleanup-guard.mjs \\
  --source-dir force-app \\
  --report docs/basic-code-cleanup-guard/basic-code-cleanup-report.md \\
  --json docs/basic-code-cleanup-guard/basic-code-cleanup-report.json

Low-risk cleanup only:
  - removes trailing spaces and tabs
  - ensures one final newline when a text file is non-empty

Options:
  --source-dir  Source directory to scan. Defaults to force-app.
  --report      Markdown report path.
  --json        JSON report path.
  --dry-run     Generate report without writing files.
`);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function isSupportedTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || filePath.endsWith("-meta.xml");
}

function cleanupText(content) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const normalized = content.replace(/\r\n/g, "\n");
  const hadFinalNewline = normalized.endsWith("\n");
  const lines = normalized.split("\n");

  if (hadFinalNewline) {
    lines.pop();
  }

  let trailingWhitespaceLines = 0;
  const cleanedLines = lines.map((line) => {
    const cleaned = line.replace(/[ \t]+$/g, "");
    if (cleaned !== line) {
      trailingWhitespaceLines++;
    }
    return cleaned;
  });

  let cleaned = cleanedLines.join("\n");
  let addedFinalNewline = false;

  if (cleaned.length > 0) {
    if (!hadFinalNewline) {
      addedFinalNewline = true;
    }
    cleaned += "\n";
  }

  if (eol === "\r\n") {
    cleaned = cleaned.replace(/\n/g, "\r\n");
  }

  return {
    content: cleaned,
    trailingWhitespaceLines,
    addedFinalNewline,
  };
}

function markdownTable(rows) {
  if (!rows.length) {
    return "_No cleanup changes needed._";
  }

  return [
    "| File | Trailing whitespace lines | Final newline added |",
    "| --- | ---: | --- |",
    ...rows.map((row) =>
      `| \`${row.file}\` | ${row.trailingWhitespaceLines} | ${row.addedFinalNewline ? "yes" : "no"} |`,
    ),
  ].join("\n");
}

async function writeText(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function main() {
  const startedAt = new Date().toISOString();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const root = process.cwd();
  const sourceDir = path.resolve(root, args.sourceDir);

  if (!(await pathExists(sourceDir))) {
    throw new Error(`Source directory was not found: ${args.sourceDir}`);
  }

  const allFiles = await walk(sourceDir);
  const textFiles = allFiles.filter(isSupportedTextFile);
  const changes = [];

  for (const filePath of textFiles) {
    const before = await fs.readFile(filePath, "utf8");
    const result = cleanupText(before);

    if (result.content === before) {
      continue;
    }

    const relative = toPosix(path.relative(root, filePath));
    changes.push({
      file: relative,
      trailingWhitespaceLines: result.trailingWhitespaceLines,
      addedFinalNewline: result.addedFinalNewline,
      status: args.dryRun ? "would update" : "updated",
    });

    if (!args.dryRun) {
      await fs.writeFile(filePath, result.content, "utf8");
    }
  }

  const finishedAt = new Date().toISOString();
  const report = {
    startedAt,
    finishedAt,
    dryRun: args.dryRun,
    sourceDir: toPosix(path.relative(root, sourceDir)) || ".",
    scannedTextFiles: textFiles.length,
    changedFiles: changes.length,
    trailingWhitespaceLinesFixed: changes.reduce((total, change) => total + change.trailingWhitespaceLines, 0),
    finalNewlinesAdded: changes.filter((change) => change.addedFinalNewline).length,
    changes,
  };

  const markdown = `# Basic Code Cleanup Guard Report

- Started: \`${startedAt}\`
- Finished: \`${finishedAt}\`
- Source directory: \`${report.sourceDir}\`
- Dry run: \`${args.dryRun}\`
- Text files scanned: **${report.scannedTextFiles}**
- Files changed: **${report.changedFiles}**
- Trailing whitespace lines fixed: **${report.trailingWhitespaceLinesFixed}**
- Final newlines added: **${report.finalNewlinesAdded}**

## Changes

${markdownTable(changes)}
`;

  await writeText(path.resolve(root, args.report), markdown);
  await writeText(path.resolve(root, args.json), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Basic cleanup completed. Changed files: ${changes.length}`);
  console.log(`Trailing whitespace lines fixed: ${report.trailingWhitespaceLinesFixed}`);
  console.log(`Final newlines added: ${report.finalNewlinesAdded}`);
  console.log(`Markdown report: ${args.report}`);
  console.log(`JSON report: ${args.json}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
