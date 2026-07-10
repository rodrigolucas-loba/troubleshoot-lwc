import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

function parseArgs(argv) {
  const args = { waitMs: 8000 };
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (["--url-json", "--manifest", "--output", "--wait-ms"].includes(key)) {
      const name = key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      args[name] = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }
  args.waitMs = Number(args.waitMs || 8000);
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const authResult = JSON.parse(await fs.readFile(args.urlJson, "utf8"));
  const manifest = JSON.parse(await fs.readFile(args.manifest, "utf8"));
  const url = authResult?.result?.url || authResult?.url;
  if (!url) throw new Error("Salesforce frontdoor URL was not found.");

  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const pageErrors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(args.waitMs);

    const contract = await page.evaluate(({ harnessBundle, expectedComponents }) => {
      const styleProperties = [
        "display",
        "visibility",
        "position",
        "minWidth",
        "maxWidth",
        "minHeight",
        "maxHeight",
        "marginTop",
        "marginRight",
        "marginBottom",
        "marginLeft",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "color",
        "backgroundColor",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "fontSize",
        "fontWeight",
        "lineHeight",
      ];

      function normalizeText(value) {
        return String(value || "").replace(/\s+/g, " ").trim().slice(0, 300);
      }

      function childrenOf(element) {
        const root = element.shadowRoot || element;
        return [...root.children].filter((child) => child.tagName !== "STYLE" && child.tagName !== "SCRIPT");
      }

      function snapshot(element, depth = 0, siblingIndex = 0) {
        if (!element || depth > 8) return null;
        const rect = element.getBoundingClientRect();
        const computed = getComputedStyle(element);
        const styles = Object.fromEntries(styleProperties.map((property) => [property, computed[property]]));
        return {
          path: `${element.tagName.toLowerCase()}:${siblingIndex}`,
          tag: element.tagName.toLowerCase(),
          text: normalizeText(element.childElementCount ? "" : element.textContent),
          rect: {
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
          },
          styles,
          children: childrenOf(element).map((child, index) => snapshot(child, depth + 1, index)).filter(Boolean),
        };
      }

      const harnessTag = `c-${harnessBundle.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
      const harness = document.querySelector(harnessTag);
      const root = harness?.shadowRoot || harness;
      const components = {};
      for (const name of expectedComponents) {
        const section = root?.querySelector(`[data-contract-id="${name}"]`);
        const target = section?.querySelector(`[data-contract-component="${name}"]`);
        components[name] = target ? snapshot(target) : null;
      }
      return { harnessFound: Boolean(harness), components };
    }, {
      harnessBundle: manifest.harnessBundle,
      expectedComponents: manifest.components.map((component) => component.bundle),
    });

    const result = {
      capturedAt: new Date().toISOString(),
      route: manifest.route,
      expectedComponents: manifest.components.map((component) => component.bundle),
      consoleErrors,
      pageErrors,
      ...contract,
    };
    await fs.mkdir(path.dirname(path.resolve(args.output)), { recursive: true });
    await fs.writeFile(args.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    if (!result.harnessFound || Object.values(result.components).some((component) => component === null)) process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
