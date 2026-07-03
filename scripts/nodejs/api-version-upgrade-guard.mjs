import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = {
    sourceDir: "force-app",
    report: "docs/api-version-upgrade-guard/report.md",
    json: "docs/api-version-upgrade-guard/report.json",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--target-api") {
      args.targetApi = next;
      i++;
    } else if (arg === "--source-dir") {
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
node scripts/nodejs/api-version-upgrade-guard.mjs \\
  --target-api 66.0 \\
  --source-dir force-app \\
  --report docs/api-version-upgrade-guard/report.md \\
  --json docs/api-version-upgrade-guard/report.json

Options:
  --target-api   Required. Salesforce API version to apply, for example 66.0.
  --source-dir   Salesforce source directory. Defaults to force-app.
  --report       Markdown report path.
  --json         JSON report path.
  --dry-run      Generate report without writing project files.
`);
}

function normalizeApiVersion(value) {
  const raw = String(value || "").trim();
  if (/^\d+$/.test(raw)) {
    return `${raw}.0`;
  }
  if (/^\d+\.\d+$/.test(raw)) {
    return raw;
  }
  throw new Error(`Invalid API version "${value}". Expected format like 66.0.`);
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

function replaceXmlApiVersion(content, targetApi) {
  const pattern = /(<apiVersion>\s*)[^<]+(\s*<\/apiVersion>)/g;
  let count = 0;
  let previous = "";
  const nextContent = content.replace(pattern, (match, open, close) => {
    const current = match.replace(/<\/?apiVersion>/g, "").trim();
    if (!previous) {
      previous = current;
    }
    count++;
    return `${open}${targetApi}${close}`;
  });

  return {
    count,
    previous,
    nextContent,
    changed: nextContent !== content,
  };
}

function markdownTable(rows) {
  if (!rows.length) {
    return "_No metadata API version changes needed._";
  }

  const lines = [
    "| File | Previous | Target | Status |",
    "| --- | --- | --- | --- |",
  ];

  for (const row of rows) {
    lines.push(
      `| \`${row.file}\` | \`${row.previousApiVersion || "n/a"}\` | \`${row.targetApiVersion}\` | ${row.status} |`,
    );
  }

  return lines.join("\n");
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

  const targetApi = normalizeApiVersion(args.targetApi);
  const root = process.cwd();
  const sourceDir = path.resolve(root, args.sourceDir);
  const projectPath = path.resolve(root, "sfdx-project.json");

  if (!(await pathExists(sourceDir))) {
    throw new Error(`Source directory was not found: ${args.sourceDir}`);
  }

  const changes = [];
  const warnings = [];

  let projectJson;
  let previousSourceApi = "";

  if (await pathExists(projectPath)) {
    const projectRaw = await fs.readFile(projectPath, "utf8");
    projectJson = JSON.parse(projectRaw);
    previousSourceApi = projectJson.sourceApiVersion || "";
  } else {
    warnings.push("sfdx-project.json was not found. A minimal project file was created in the runner for validation.");
    projectJson = {
      packageDirectories: [
        {
          path: args.sourceDir,
          default: true,
        },
      ],
      name: "api-version-upgrade-guard",
      namespace: "",
      sfdcLoginUrl: "https://login.salesforce.com",
      sourceApiVersion: targetApi,
    };
  }

  if (previousSourceApi !== targetApi) {
    projectJson.sourceApiVersion = targetApi;
    changes.push({
      type: "sfdx-project",
      file: "sfdx-project.json",
      previousApiVersion: previousSourceApi,
      targetApiVersion: targetApi,
      status: args.dryRun ? "would update" : "updated",
    });

    if (!args.dryRun) {
      await fs.writeFile(projectPath, `${JSON.stringify(projectJson, null, 2)}\n`, "utf8");
    }
  }

  const allFiles = await walk(sourceDir);
  const metaFiles = allFiles.filter((file) => file.endsWith("-meta.xml"));
  let scannedMetadataFiles = 0;

  for (const file of metaFiles) {
    scannedMetadataFiles++;
    const content = await fs.readFile(file, "utf8");
    const result = replaceXmlApiVersion(content, targetApi);

    if (result.count === 0) {
      continue;
    }

    const relative = toPosix(path.relative(root, file));
    if (result.count > 1) {
      warnings.push(`${relative} contains ${result.count} apiVersion tags.`);
    }

    if (result.changed) {
      changes.push({
        type: "metadata",
        file: relative,
        previousApiVersion: result.previous,
        targetApiVersion: targetApi,
        status: args.dryRun ? "would update" : "updated",
      });

      if (!args.dryRun) {
        await fs.writeFile(file, result.nextContent, "utf8");
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const report = {
    startedAt,
    finishedAt,
    dryRun: args.dryRun,
    targetApiVersion: targetApi,
    sourceDir: toPosix(path.relative(root, sourceDir)) || ".",
    scannedMetadataFiles,
    changedFiles: changes.length,
    warnings,
    changes,
  };

  const markdown = `# API Version Upgrade Guard Report

- Started: \`${startedAt}\`
- Finished: \`${finishedAt}\`
- Source directory: \`${report.sourceDir}\`
- Target API version: \`${targetApi}\`
- Dry run: \`${args.dryRun}\`
- Metadata files scanned: **${scannedMetadataFiles}**
- Files changed: **${changes.length}**

## Changes

${markdownTable(changes)}

## Warnings

${warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "_No warnings._"}
`;

  await writeText(path.resolve(root, args.report), markdown);
  await writeText(path.resolve(root, args.json), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`API version guard completed. Changed files: ${changes.length}`);
  console.log(`Markdown report: ${args.report}`);
  console.log(`JSON report: ${args.json}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
