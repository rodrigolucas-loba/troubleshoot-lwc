import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!["--project", "--source-dir", "--target-api", "--json"].includes(key)) {
      throw new Error(`Unknown argument: ${key}`);
    }
    args[key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[++index];
  }
  return args;
}

function validateApiVersion(value) {
  const version = String(value || "").trim();
  if (!/^\d+\.0$/.test(version)) throw new Error(`Invalid Salesforce API version: ${version || "empty"}`);
  return version;
}

async function ensureSalesforceProject(args) {
  const projectPath = path.resolve(args.project || "sfdx-project.json");
  const sourceDir = String(args.sourceDir || "force-app").replaceAll("\\", "/");

  try {
    await fs.access(projectPath);
    return { created: false, project: path.basename(projectPath), sourceDir };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const targetApi = validateApiVersion(args.targetApi);
  const project = {
    packageDirectories: [{ path: sourceDir, default: true }],
    name: "cleanup-guard-validation",
    namespace: "",
    sfdcLoginUrl: "https://login.salesforce.com",
    sourceApiVersion: targetApi,
  };

  await fs.writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
  return { created: true, project: path.basename(projectPath), sourceDir, targetApi };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await ensureSalesforceProject(args);
  if (args.json) {
    const reportPath = path.resolve(args.json);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  console.log(result.created ? `Created temporary Salesforce project at ${result.project}.` : `${result.project} already exists.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export { ensureSalesforceProject, validateApiVersion };
