import assert from "node:assert/strict";
import test from "node:test";

import {
  extractVersions,
  normalizeVersion,
  resolveVersion,
} from "../../scripts/nodejs/resolve-salesforce-api-version.mjs";

const response = {
  status: 0,
  result: [
    { version: "65.0", label: "Winter '26" },
    { version: "67.0", label: "Summer '26" },
    { version: "66.0", label: "Spring '26" },
  ],
};

test("extractVersions sorts Salesforce versions numerically", () => {
  assert.deepEqual(extractVersions(response), ["65.0", "66.0", "67.0"]);
});

test("auto resolves to the highest version supported by the org", () => {
  assert.deepEqual(resolveVersion("auto", extractVersions(response)), {
    version: "67.0",
    source: "validation_org_latest",
  });
});

test("manual versions must be supported by the validation org", () => {
  assert.equal(resolveVersion("66.0", extractVersions(response)).version, "66.0");
  assert.throws(() => resolveVersion("68.0", extractVersions(response)), /not supported/);
});

test("API versions use Salesforce major-dot-zero format", () => {
  assert.equal(normalizeVersion("66.0"), "66.0");
  assert.throws(() => normalizeVersion("66"), /Invalid Salesforce API version/);
});
