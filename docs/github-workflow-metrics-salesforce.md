# GitHub Workflow Metrics to Salesforce

This setup sends one record per GitHub Actions run to Salesforce through the custom object `GitHub_Workflow_Metric__c`.

## What the workflow sends

- Project and repository identifiers
- Workflow and branch context
- Run ID, run number, run URL, commit SHA
- Event name and actor
- Total findings
- High findings
- Critical findings
- Analyzer exit code
- Workflow conclusion used by the quality gate

## Required GitHub secret

Create this repository secret:

- `SF_AUTH_URL_METRICS`

The value must be an SFDX auth URL for a Salesforce integration user with:

- `API Enabled`
- access to the custom object `GitHub_Workflow_Metric__c`
- the permission set `GitHub Workflow Metrics Integration`

## Required Salesforce metadata

This repo now includes:

- `GitHub_Workflow_Metric__c`
- `GitHub_Workflow_Metrics` custom tab
- `GitHub Workflow Metrics Integration` permission set

## How the sync works

1. The analyzer job runs as normal.
2. The workflow authenticates to Salesforce if `SF_AUTH_URL_METRICS` exists.
3. It performs an upsert using `Run_Id__c` as the external ID.
4. Each workflow run updates or creates a single Salesforce record.

## Notes

- If the secret is missing, Salesforce sync is skipped and the analyzer workflow still works.
- The metrics sync runs before the final critical-finding gate so failed quality runs are still written to Salesforce.
- This file can be updated to force a fresh workflow run on a `WI-*` branch when needed for validation.
