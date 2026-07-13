import assert from "node:assert/strict";
import test from "node:test";

import { buildDecision } from "../../scripts/nodejs/evaluate-cleanup-trust-gate.mjs";

const cleanReports = {
  summary: { new_findings: "0", new_high_or_critical: "0" },
  diff: { diff_files: "3" },
  formatting: { status: "completed" },
  eslintFix: { postFixPrettierExitCode: 0 },
};

const validatedOptions = {
  analyzerAfterExitCode: "0",
  deployRequested: "true",
  deployEnforced: "true",
  deployStatus: "passed",
  lwcRequested: "true",
  lwcEnforced: "true",
  lwcStatus: "passed",
};

test("trust gate blocks any newly introduced finding", () => {
  const result = buildDecision({
    ...cleanReports,
    summary: { new_findings: "1", new_high_or_critical: "0" },
    options: validatedOptions,
    changedLwc: true,
  });

  assert.equal(result.decision, "BLOCK");
  assert.equal(result.allowFixBranch, false);
});

test("trust gate marks a completely validated patch safe to review", () => {
  const result = buildDecision({ ...cleanReports, options: validatedOptions, changedLwc: true });

  assert.equal(result.decision, "SAFE_TO_REVIEW");
  assert.equal(result.allowFixBranch, true);
});

test("trust gate requests review when changed LWC was not runtime validated", () => {
  const options = { ...validatedOptions, lwcRequested: "false", lwcStatus: "not_executed" };
  const result = buildDecision({ ...cleanReports, options, changedLwc: true });

  assert.equal(result.decision, "REVIEW");
  assert.match(result.reviewReasons.join(" "), /LWC/);
});

test("trust gate blocks an enforced Salesforce validation failure", () => {
  const options = { ...validatedOptions, deployStatus: "failed" };
  const result = buildDecision({ ...cleanReports, options, changedLwc: false });

  assert.equal(result.decision, "BLOCK");
  assert.match(result.blockers.join(" "), /Salesforce/);
});
