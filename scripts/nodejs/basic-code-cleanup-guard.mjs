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
  - applies conservative JavaScript cleanup for analyzer findings:
    - var to let
    - unused event handler parameter removal
    - simple let to const
    - insecure http string literals to https
    - simple JSON deep clone to structuredClone
    - Math.random to Web Crypto random value

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

function findMatchingBrace(content, openIndex) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openIndex; index < content.length; index++) {
    const char = content[index];
    const next = content[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index++;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index++;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index++;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function replaceSimpleVarWithLet(content) {
  let converted = 0;
  const lines = content.split("\n");
  const updatedLines = lines.map((line) => {
    if (!/^[ \t]*var\s+/.test(line)) {
      return line;
    }

    converted++;
    return line.replace(/^([ \t]*)var(\s+)/, "$1let$2");
  });

  return { content: updatedLines.join("\n"), converted };
}

function removeUnusedEventParameters(content) {
  let updated = content;
  let removed = 0;
  const methodPattern = /(^[ \t]*(?:async[ \t]+)?[A-Za-z_$][\w$]*\()event(\)[ \t]*\{)/gm;
  const matches = [...updated.matchAll(methodPattern)].reverse();

  for (const match of matches) {
    const openBraceIndex = match.index + match[0].lastIndexOf("{");
    const closeBraceIndex = findMatchingBrace(updated, openBraceIndex);
    if (closeBraceIndex === -1) {
      continue;
    }

    const body = updated.slice(openBraceIndex + 1, closeBraceIndex);
    if (/\bevent\b/.test(body)) {
      continue;
    }

    updated = `${updated.slice(0, match.index)}${match[1]}${match[2]}${updated.slice(match.index + match[0].length)}`;
    removed++;
  }

  return { content: updated, removed };
}

function replaceSimpleLetWithConst(content) {
  let updated = content;
  let converted = 0;
  const declarationPattern = /\blet\s+([A-Za-z_$][\w$]*)\s*=/g;
  const matches = [...updated.matchAll(declarationPattern)].reverse();

  for (const match of matches) {
    const name = match[1];
    const lineStart = updated.lastIndexOf("\n", match.index) + 1;
    const lineEnd = updated.indexOf("\n", match.index);
    const declarationLine = updated.slice(lineStart, lineEnd === -1 ? updated.length : lineEnd);

    if (/\bfor\s*\(/.test(declarationLine)) {
      continue;
    }

    const afterDeclaration = updated.slice(match.index + match[0].length);
    const assignmentPattern = new RegExp(`(?:^|[^.$\\w])${name}\\s*(?:=|\\+=|-=|\\*=|/=|%=|\\+\\+|--)`);
    if (assignmentPattern.test(afterDeclaration)) {
      continue;
    }

    updated = `${updated.slice(0, match.index)}const ${name} =${updated.slice(match.index + match[0].length)}`;
    converted++;
  }

  return { content: updated, converted };
}

function replaceInsecureHttp(content) {
  const converted = (content.match(/http:\/\//g) || []).length;
  return {
    content: content.replace(/http:\/\//g, "https://"),
    converted,
  };
}

function replaceSimpleJsonClone(content) {
  let converted = 0;
  const updated = content.replace(/JSON\.parse\(\s*JSON\.stringify\(([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\)\s*\)/g, (_match, value) => {
    converted++;
    return `structuredClone(${value})`;
  });

  return { content: updated, converted };
}

function replaceMathRandom(content) {
  const converted = (content.match(/Math\.random\(\)/g) || []).length;
  return {
    content: content.replace(/Math\.random\(\)/g, "(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296)"),
    converted,
  };
}

function cleanupJavaScript(content) {
  let updated = content;
  const varToLet = replaceSimpleVarWithLet(updated);
  updated = varToLet.content;

  const unusedEvent = removeUnusedEventParameters(updated);
  updated = unusedEvent.content;

  const letToConst = replaceSimpleLetWithConst(updated);
  updated = letToConst.content;

  const insecureHttp = replaceInsecureHttp(updated);
  updated = insecureHttp.content;

  const jsonClone = replaceSimpleJsonClone(updated);
  updated = jsonClone.content;

  const mathRandom = replaceMathRandom(updated);
  updated = mathRandom.content;

  return {
    content: updated,
    varToLet: varToLet.converted,
    unusedEventParamsRemoved: unusedEvent.removed,
    letToConst: letToConst.converted,
    insecureHttpFixed: insecureHttp.converted,
    jsonCloneFixed: jsonClone.converted,
    mathRandomFixed: mathRandom.converted,
  };
}

function markdownTable(rows) {
  if (!rows.length) {
    return "_No cleanup changes needed._";
  }

  return [
    "| File | Trailing whitespace lines | Final newline added | var to let | unused event params | let to const | http to https | structuredClone | crypto random |",
    "| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((row) =>
      `| \`${row.file}\` | ${row.trailingWhitespaceLines} | ${row.addedFinalNewline ? "yes" : "no"} | ${row.varToLet || 0} | ${row.unusedEventParamsRemoved || 0} | ${row.letToConst || 0} | ${row.insecureHttpFixed || 0} | ${row.jsonCloneFixed || 0} | ${row.mathRandomFixed || 0} |`,
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
    const textResult = cleanupText(before);
    const jsResult = path.extname(filePath).toLowerCase() === ".js" ? cleanupJavaScript(textResult.content) : null;
    const result = {
      ...textResult,
      content: jsResult ? jsResult.content : textResult.content,
      varToLet: jsResult?.varToLet || 0,
      unusedEventParamsRemoved: jsResult?.unusedEventParamsRemoved || 0,
      letToConst: jsResult?.letToConst || 0,
      insecureHttpFixed: jsResult?.insecureHttpFixed || 0,
      jsonCloneFixed: jsResult?.jsonCloneFixed || 0,
      mathRandomFixed: jsResult?.mathRandomFixed || 0,
    };

    if (result.content === before) {
      continue;
    }

    const relative = toPosix(path.relative(root, filePath));
    changes.push({
      file: relative,
      trailingWhitespaceLines: result.trailingWhitespaceLines,
      addedFinalNewline: result.addedFinalNewline,
      varToLet: result.varToLet,
      unusedEventParamsRemoved: result.unusedEventParamsRemoved,
      letToConst: result.letToConst,
      insecureHttpFixed: result.insecureHttpFixed,
      jsonCloneFixed: result.jsonCloneFixed,
      mathRandomFixed: result.mathRandomFixed,
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
    varToLetFixed: changes.reduce((total, change) => total + change.varToLet, 0),
    unusedEventParamsRemoved: changes.reduce((total, change) => total + change.unusedEventParamsRemoved, 0),
    letToConstFixed: changes.reduce((total, change) => total + change.letToConst, 0),
    insecureHttpFixed: changes.reduce((total, change) => total + change.insecureHttpFixed, 0),
    jsonCloneFixed: changes.reduce((total, change) => total + change.jsonCloneFixed, 0),
    mathRandomFixed: changes.reduce((total, change) => total + change.mathRandomFixed, 0),
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
- JavaScript var to let fixes: **${report.varToLetFixed}**
- Unused event parameters removed: **${report.unusedEventParamsRemoved}**
- JavaScript let to const fixes: **${report.letToConstFixed}**
- JavaScript http to https fixes: **${report.insecureHttpFixed}**
- JavaScript structuredClone fixes: **${report.jsonCloneFixed}**
- JavaScript crypto random fixes: **${report.mathRandomFixed}**

## Changes

${markdownTable(changes)}
`;

  await writeText(path.resolve(root, args.report), markdown);
  await writeText(path.resolve(root, args.json), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Basic cleanup completed. Changed files: ${changes.length}`);
  console.log(`Trailing whitespace lines fixed: ${report.trailingWhitespaceLinesFixed}`);
  console.log(`Final newlines added: ${report.finalNewlinesAdded}`);
  console.log(`JavaScript var to let fixes: ${report.varToLetFixed}`);
  console.log(`Unused event parameters removed: ${report.unusedEventParamsRemoved}`);
  console.log(`JavaScript let to const fixes: ${report.letToConstFixed}`);
  console.log(`JavaScript http to https fixes: ${report.insecureHttpFixed}`);
  console.log(`JavaScript structuredClone fixes: ${report.jsonCloneFixed}`);
  console.log(`JavaScript crypto random fixes: ${report.mathRandomFixed}`);
  console.log(`Markdown report: ${args.report}`);
  console.log(`JSON report: ${args.json}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
