import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = { tolerancePx: 1 };
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (["--baseline", "--candidate", "--json", "--markdown", "--tolerance-px"].includes(key)) {
      args[key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }
  args.tolerancePx = Number(args.tolerancePx || 1);
  return args;
}

function flatten(node, parent = "", output = new Map()) {
  if (!node) return output;
  const key = `${parent}/${node.path}`;
  output.set(key, node);
  for (const child of node.children || []) flatten(child, key, output);
  return output;
}

function compareComponent(name, baseline, candidate, tolerancePx) {
  const differences = [];
  if (!baseline || !candidate) {
    differences.push({ component: name, path: "/", field: "rendered", before: Boolean(baseline), after: Boolean(candidate) });
    return differences;
  }
  const beforeNodes = flatten(baseline);
  const afterNodes = flatten(candidate);
  const paths = new Set([...beforeNodes.keys(), ...afterNodes.keys()]);

  for (const nodePath of paths) {
    const before = beforeNodes.get(nodePath);
    const after = afterNodes.get(nodePath);
    if (!before || !after) {
      differences.push({ component: name, path: nodePath, field: "node", before: before?.tag || null, after: after?.tag || null });
      continue;
    }
    if (before.tag !== after.tag || before.text !== after.text) {
      differences.push({ component: name, path: nodePath, field: "content", before: `${before.tag}:${before.text}`, after: `${after.tag}:${after.text}` });
    }
    for (const dimension of ["width", "height"]) {
      if (Math.abs(Number(before.rect[dimension]) - Number(after.rect[dimension])) > tolerancePx) {
        differences.push({ component: name, path: nodePath, field: dimension, before: before.rect[dimension], after: after.rect[dimension] });
      }
    }
    for (const [property, beforeValue] of Object.entries(before.styles || {})) {
      const afterValue = after.styles?.[property];
      if (beforeValue !== afterValue) {
        differences.push({ component: name, path: nodePath, field: property, before: beforeValue, after: afterValue });
      }
    }
  }
  return differences;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseline = JSON.parse(await fs.readFile(args.baseline, "utf8"));
  const candidate = JSON.parse(await fs.readFile(args.candidate, "utf8"));
  const names = new Set([...Object.keys(baseline.components || {}), ...Object.keys(candidate.components || {})]);
  const differences = [...names].flatMap((name) =>
    compareComponent(name, baseline.components?.[name], candidate.components?.[name], args.tolerancePx),
  );
  const newConsoleErrors = (candidate.consoleErrors || []).filter((error) => !(baseline.consoleErrors || []).includes(error));
  const newPageErrors = (candidate.pageErrors || []).filter((error) => !(baseline.pageErrors || []).includes(error));
  const passed = baseline.harnessFound && candidate.harnessFound && differences.length === 0 && newConsoleErrors.length === 0 && newPageErrors.length === 0;
  const result = {
    status: passed ? "passed" : "failed",
    componentsChecked: names.size,
    differences: differences.slice(0, 200),
    differenceCount: differences.length,
    newConsoleErrors,
    newPageErrors,
    tolerancePx: args.tolerancePx,
  };
  await fs.mkdir(path.dirname(path.resolve(args.json)), { recursive: true });
  await fs.mkdir(path.dirname(path.resolve(args.markdown)), { recursive: true });
  await fs.writeFile(args.json, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await fs.writeFile(
    args.markdown,
    `# LWC contract validation\n\n- Status: **${result.status}**\n- Components checked: **${result.componentsChecked}**\n- Contract differences: **${result.differenceCount}**\n- New console errors: **${newConsoleErrors.length}**\n- New page errors: **${newPageErrors.length}**\n- Dimension tolerance: **${result.tolerancePx}px**\n`,
    "utf8",
  );
  console.log(`LWC contract validation: ${result.status}. Differences: ${result.differenceCount}.`);
  if (!passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

export { compareComponent, flatten };
