import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  applyBraceFixes,
  applyLocationFixes,
  parseCsv,
  replaceNearColumn,
  resolveProjectFile,
} from "../../scripts/nodejs/apply-analyzer-guided-fixes.mjs";

test("parseCsv handles quoted commas and escaped quotes", () => {
  const rows = parseCsv('File,Message\nforce-app/test.cls,"Use ""safe"", value"\n');

  assert.deepEqual(rows, [{ File: "force-app/test.cls", Message: 'Use "safe", value' }]);
});

test("resolveProjectFile rejects analyzer paths outside the checkout", () => {
  const root = path.resolve("project");

  assert.throws(() => resolveProjectFile(root, "../secret.txt"), /outside the project/);
});

test("location fixes prefer the analyzer column", () => {
  const line = "color: #fff; border-color: #fff;";
  const replacement = replaceNearColumn(line, 28, "#fff", "var(--color, #fff)");
  const result = applyLocationFixes(`${line}\n`, [
    { line: 1, column: 28, expected: "#fff", replacement: "var(--color, #fff)" },
  ]);

  assert.equal(replacement, "color: #fff; border-color: var(--color, #fff);");
  assert.equal(result.content, `${replacement}\n`);
  assert.equal(result.applied, 1);
});

test("brace fixes wrap a single Apex if statement", () => {
  const result = applyBraceFixes("if (ready)\n  run();\n", [{ startLine: "1" }]);

  assert.equal(result.content, "if (ready) {\n  run();\n}\n");
  assert.equal(result.applied, 1);
});
