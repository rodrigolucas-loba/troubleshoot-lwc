import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const HARNESS_BUNDLE = "autofixValidationHarness";
const HOST_BUNDLE = "autofixValidationHarnessHost";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (["--project-root", "--source-dir", "--changed-files", "--manifest"].includes(key)) {
      args[key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }
  return args;
}

function componentTag(bundleName) {
  return `c-${bundleName.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.projectRoot || ".");
  const sourceDir = args.sourceDir || "force-app";
  const changedText = await fs.readFile(path.resolve(args.changedFiles), "utf8");
  const prefix = `${sourceDir.replace(/\\/g, "/")}/main/default/lwc/`;
  const candidates = new Set();

  for (const rawLine of changedText.split(/\r?\n/)) {
    const file = rawLine.trim().replace(/\\/g, "/");
    if (!file.startsWith(prefix)) continue;
    const bundle = file.slice(prefix.length).split("/")[0];
    if (bundle && bundle !== HARNESS_BUNDLE) candidates.add(bundle);
  }

  const components = [];
  for (const bundle of [...candidates].sort()) {
    const bundleDir = path.join(root, sourceDir, "main", "default", "lwc", bundle);
    if ((await exists(path.join(bundleDir, `${bundle}.js`))) && (await exists(path.join(bundleDir, `${bundle}.html`)))) {
      components.push({ bundle, tag: componentTag(bundle) });
    }
  }

  const projectConfigPath = path.join(root, "sfdx-project.json");
  let apiVersion = "66.0";
  if (await exists(projectConfigPath)) {
    const projectConfig = JSON.parse(await fs.readFile(projectConfigPath, "utf8"));
    apiVersion = String(projectConfig.sourceApiVersion || apiVersion);
  }

  const bundleDir = path.join(root, sourceDir, "main", "default", "lwc", HARNESS_BUNDLE);
  const hostDir = path.join(root, sourceDir, "main", "default", "aura", HOST_BUNDLE);
  await fs.mkdir(bundleDir, { recursive: true });
  await fs.mkdir(hostDir, { recursive: true });

  const sections = components.length
    ? components
        .map(
          ({ bundle, tag }) => `    <section class="contract" data-contract-id="${bundle}">
      <h2>${bundle}</h2>
      <${tag} data-contract-component="${bundle}"></${tag}>
    </section>`,
        )
        .join("\n")
    : '    <p data-contract-empty="true">No changed LWC bundles were detected.</p>';

  await fs.writeFile(
    path.join(bundleDir, `${HARNESS_BUNDLE}.html`),
    `<template>\n  <main data-contract-harness="true">\n${sections}\n  </main>\n</template>\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(bundleDir, `${HARNESS_BUNDLE}.js`),
    `import { LightningElement } from "lwc";\n\nexport default class AutofixValidationHarness extends LightningElement {}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(bundleDir, `${HARNESS_BUNDLE}.css`),
    `.contract {\n  border-block-end: 1px solid #d8dde6;\n  padding-block: 1rem;\n}\n\nh2 {\n  font-size: 1rem;\n  font-weight: 700;\n}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(bundleDir, `${HARNESS_BUNDLE}.js-meta.xml`),
    `<?xml version="1.0" encoding="UTF-8"?>\n<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n  <apiVersion>${apiVersion}</apiVersion>\n  <isExposed>true</isExposed>\n  <masterLabel>Autofix Validation Harness</masterLabel>\n  <targets>\n    <target>lightning__Tab</target>\n  </targets>\n</LightningComponentBundle>\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(hostDir, `${HOST_BUNDLE}.cmp`),
    `<aura:component implements="force:appHostable,flexipage:availableForAllPageTypes" access="global">\n  <c:${HARNESS_BUNDLE} />\n</aura:component>\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(hostDir, `${HOST_BUNDLE}.cmp-meta.xml`),
    `<?xml version="1.0" encoding="UTF-8"?>\n<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n  <apiVersion>${apiVersion}</apiVersion>\n  <description>Temporary host for the autofix LWC contract harness.</description>\n</AuraDefinitionBundle>\n`,
    "utf8",
  );

  const manifest = {
    apiVersion,
    components,
    harnessBundle: HARNESS_BUNDLE,
    hostBundle: HOST_BUNDLE,
    route: `/lightning/cmp/c__${HOST_BUNDLE}`,
  };
  const manifestPath = path.resolve(args.manifest);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Generated LWC contract harness for ${components.length} component(s).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
