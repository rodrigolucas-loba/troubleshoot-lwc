import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`Unknown argument: ${key}`);
    args[key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[++index];
  }
  return args;
}

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return separator === -1 ? [line, ""] : [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

async function readEnvFile(filePath) {
  try {
    return parseEnv(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function isTrue(value) {
  return String(value).toLowerCase() === "true";
}

function buildDecision({ summary, diff, formatting, eslintFix, options, changedLwc }) {
  const blockers = [];
  const reviewReasons = [];
  const changedFiles = Number(diff?.diff_files || 0);

  if (!summary || !diff) blockers.push("required comparison reports are missing");
  if (String(options.analyzerAfterExitCode) !== "0") blockers.push("the post-cleanup Analyzer run failed");
  if (Number(summary?.new_high_or_critical || 0) > 0) blockers.push("new High/Critical Analyzer findings were introduced");
  if (Number(summary?.new_findings || 0) > 0) blockers.push("new Analyzer findings were introduced");
  if (formatting.status === "prettier_failed" || Number(eslintFix.postFixPrettierExitCode || 0) !== 0) {
    blockers.push("formatting verification failed");
  }
  if (changedFiles === 0) reviewReasons.push("the cleanup produced no patch");

  const deployRequested = isTrue(options.deployRequested);
  if (deployRequested && options.deployStatus !== "passed") {
    (isTrue(options.deployEnforced) ? blockers : reviewReasons).push("Salesforce deploy validation did not pass");
  } else if (!deployRequested) {
    reviewReasons.push("Salesforce deploy validation was not executed");
  }

  const lwcRequested = isTrue(options.lwcRequested);
  const lwcPassed = ["passed", "skipped_no_lwc"].includes(options.lwcStatus);
  if (lwcRequested && !lwcPassed) {
    (isTrue(options.lwcEnforced) ? blockers : reviewReasons).push("LWC runtime contract validation did not pass");
  } else if (changedLwc && !lwcRequested) {
    reviewReasons.push("changed LWC bundles were not runtime-validated");
  }

  if (blockers.length) {
    return { decision: "BLOCK", allowFixBranch: false, blockers, reviewReasons };
  }
  if (reviewReasons.length) {
    return { decision: "REVIEW", allowFixBranch: changedFiles > 0, blockers, reviewReasons };
  }
  return { decision: "SAFE_TO_REVIEW", allowFixBranch: changedFiles > 0, blockers, reviewReasons };
}

async function evaluateTrustGate(args) {
  const reportDir = path.resolve(args.reportDir);
  const summary = await readEnvFile(path.join(reportDir, "comparison-summary.env"));
  const diff = await readEnvFile(path.join(reportDir, "diff-summary.env"));
  const formatting = await readJsonFile(path.join(reportDir, "formatting-report.json"));
  const eslintFix = await readJsonFile(path.join(reportDir, "eslint-fix-report.json"));
  const changedFiles = await fs.readFile(path.join(reportDir, "changed-files.txt"), "utf8").catch(() => "");
  const sourcePrefix = `${args.sourceDir.replaceAll("\\", "/")}/main/default/lwc/`;
  const changedLwc = changedFiles.split(/\r?\n/).some((file) => file.startsWith(sourcePrefix));
  const result = buildDecision({ summary, diff, formatting, eslintFix, options: args, changedLwc });

  return {
    ...result,
    changedFiles: Number(diff?.diff_files || 0),
    fixedFindings: Number(summary?.fixed_findings || 0),
    newFindings: Number(summary?.new_findings || 0),
    deployStatus: args.deployRequested === "true" ? args.deployStatus : "not_executed",
    lwcStatus: changedLwc ? (args.lwcRequested === "true" ? args.lwcStatus : "not_executed") : "not_applicable",
  };
}

function toMarkdown(result) {
  const reasons = [...result.blockers, ...result.reviewReasons];
  return `# Cleanup trust gate\n\n- Decision: **${result.decision}**\n- Fix branch allowed: **${result.allowFixBranch}**\n- Findings fixed: **${result.fixedFindings}**\n- New findings: **${result.newFindings}**\n- Salesforce validation: **${result.deployStatus}**\n- LWC contract: **${result.lwcStatus}**\n${reasons.length ? `- Reason: ${reasons.join("; ")}\n` : ""}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await evaluateTrustGate(args);
  await fs.writeFile(args.json, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await fs.writeFile(args.markdown, toMarkdown(result), "utf8");
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      `decision=${result.decision}\nallow_fix_branch=${result.allowFixBranch}\n`,
      "utf8",
    );
  }
  console.log(`Cleanup trust gate: ${result.decision}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

export { buildDecision, evaluateTrustGate, parseEnv, toMarkdown };
