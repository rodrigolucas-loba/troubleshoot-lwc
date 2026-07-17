import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ensureSalesforceProject,
  validateApiVersion,
} from "../../scripts/nodejs/ensure-salesforce-project.mjs";

test("creates a temporary Salesforce project when configuration is missing", async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cleanup-salesforce-project-"));
  const projectPath = path.join(temporaryDirectory, "sfdx-project.json");

  try {
    const result = await ensureSalesforceProject({
      project: projectPath,
      sourceDir: "force-app",
      targetApi: "67.0",
    });
    const project = JSON.parse(await fs.readFile(projectPath, "utf8"));

    assert.equal(result.created, true);
    assert.equal(project.sourceApiVersion, "67.0");
    assert.equal(project.packageDirectories[0].path, "force-app");
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("preserves an existing Salesforce project", async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cleanup-salesforce-project-"));
  const projectPath = path.join(temporaryDirectory, "sfdx-project.json");
  const existing = { name: "existing-project", sourceApiVersion: "66.0" };

  try {
    await fs.writeFile(projectPath, JSON.stringify(existing), "utf8");
    const result = await ensureSalesforceProject({
      project: projectPath,
      sourceDir: "force-app",
      targetApi: "67.0",
    });

    assert.equal(result.created, false);
    assert.deepEqual(JSON.parse(await fs.readFile(projectPath, "utf8")), existing);
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("rejects invalid Salesforce API versions", () => {
  assert.equal(validateApiVersion("67.0"), "67.0");
  assert.throws(() => validateApiVersion("latest"), /Invalid Salesforce API version/);
});
