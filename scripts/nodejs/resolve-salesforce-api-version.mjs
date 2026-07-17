import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!["--requested", "--project", "--versions-json", "--json", "--markdown"].includes(key)) {
      throw new Error(`Unknown argument: ${key}`);
    }
    args[key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[++index];
  }
  return args;
}

function normalizeVersion(value) {
  const text = String(value || "").trim();
  if (!/^\d+\.0$/.test(text)) throw new Error(`Invalid Salesforce API version: ${text || "empty"}`);
  return text;
}

function compareVersions(left, right) {
  return Number(left) - Number(right);
}

function extractVersions(payload) {
  const candidates = Array.isArray(payload) ? payload : payload?.result;
  if (!Array.isArray(candidates)) throw new Error("Salesforce versions response does not contain a result array.");
  return [...new Set(candidates.map((entry) => normalizeVersion(entry.version)))].sort(compareVersions);
}

function resolveVersion(requested, availableVersions) {
  if (!availableVersions.length) throw new Error("Salesforce returned no supported API versions.");
  const normalizedRequest = String(requested || "auto").trim().toLowerCase();
  if (["auto", "latest"].includes(normalizedRequest)) {
    return { version: availableVersions.at(-1), source: "validation_org_latest" };
  }

  const explicit = normalizeVersion(requested);
  if (!availableVersions.includes(explicit)) {
    throw new Error(`Requested API version ${explicit} is not supported by the validation org.`);
  }
  return { version: explicit, source: "manual_verified_against_org" };
}

async function readProject(projectPath) {
  try {
    return JSON.parse(await fs.readFile(projectPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function resolveApiVersion(args) {
  const projectPath = path.resolve(args.project || "sfdx-project.json");
  const project = await readProject(projectPath);
  const versionsPayload = JSON.parse(await fs.readFile(path.resolve(args.versionsJson), "utf8"));
  const availableVersions = extractVersions(versionsPayload);
  const resolved = resolveVersion(args.requested, availableVersions);

  return {
    requested: args.requested || "auto",
    resolved: resolved.version,
    resolutionSource: resolved.source,
    projectFileFound: project !== null,
    currentProjectVersion: project?.sourceApiVersion || null,
    highestOrgVersion: availableVersions.at(-1),
    supportedVersionCount: availableVersions.length,
  };
}

function toMarkdown(result) {
  return `# Salesforce API version resolution\n\n- Requested: **${result.requested}**\n- Resolved: **${result.resolved}**\n- Source: **${result.resolutionSource}**\n- Project file: **${result.projectFileFound ? "found" : "temporary project required"}**\n- Current project version: **${result.currentProjectVersion || "not configured"}**\n- Highest version supported by validation org: **${result.highestOrgVersion}**\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await resolveApiVersion(args);
  await fs.mkdir(path.dirname(path.resolve(args.json)), { recursive: true });
  await fs.writeFile(args.json, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await fs.writeFile(args.markdown, toMarkdown(result), "utf8");
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `target_api_version=${result.resolved}\n`, "utf8");
  }
  console.log(`Resolved Salesforce API version: ${result.resolved} (${result.resolutionSource})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

export { extractVersions, normalizeVersion, resolveApiVersion, resolveVersion };
