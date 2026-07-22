import fs from 'node:fs';
import crypto from 'node:crypto';

function getArg(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function upsertFinding({ objectName, instanceUrl, accessToken, runId, runNumber, branch, repository, runUrl, finding, index }) {
  const key = finding.key;
  const payload = {
    Name: `${branch} / Finding ${index + 1}`,
    Workflow_Run_Id__c: String(runId),
    Workflow_Run_Number__c: Number(runNumber || 0),
    Branch__c: branch || '',
    Repository__c: repository || '',
    Severity__c: finding.severity || '',
    Rule__c: finding.rule || '',
    Message__c: finding.message || '',
    Location__c: finding.location || '',
    Run_Url__c: runUrl || ''
  };

  const response = await fetch(
    `${instanceUrl}/services/data/v66.0/sobjects/${objectName}/Finding_Key__c/${encodeURIComponent(key)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  if (![200, 201, 204].includes(response.status)) {
    const body = await response.text();
    throw new Error(`Finding upsert failed for ${key} with HTTP ${response.status}: ${body}`);
  }
}

async function queryExistingFindings({ objectName, instanceUrl, accessToken, runId }) {
  const soql = `SELECT Id, Finding_Key__c FROM ${objectName} WHERE Workflow_Run_Id__c = '${String(runId).replaceAll("'", "\\'")}'`;
  const response = await fetch(
    `${instanceUrl}/services/data/v66.0/query?q=${encodeURIComponent(soql)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Finding query failed with HTTP ${response.status}: ${body}`);
  }

  const body = await response.json();
  return Array.isArray(body.records) ? body.records : [];
}

async function deleteFinding({ instanceUrl, accessToken, objectName, id }) {
  const response = await fetch(
    `${instanceUrl}/services/data/v66.0/sobjects/${objectName}/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (![200, 204].includes(response.status)) {
    const body = await response.text();
    throw new Error(`Finding delete failed for ${id} with HTTP ${response.status}: ${body}`);
  }
}

function normalizeValue(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function attachStableKeys(runId, findings) {
  const seenBySignature = new Map();

  return findings.map((finding) => {
    const signature = [
      normalizeValue(finding.severity),
      normalizeValue(finding.rule),
      normalizeValue(finding.message),
      normalizeValue(finding.location)
    ].join('|');

    const occurrence = (seenBySignature.get(signature) || 0) + 1;
    seenBySignature.set(signature, occurrence);

    const digest = crypto.createHash('sha1').update(signature).digest('hex').slice(0, 12);
    return {
      ...finding,
      key: `${runId}-${digest}-${occurrence}`
    };
  });
}

async function main() {
  const inputPath = getArg('--input');
  const sfOrgPath = getArg('--sf-org');
  const sfTokenPath = getArg('--sf-token');

  if (!inputPath || !sfOrgPath || !sfTokenPath) {
    throw new Error('Missing required arguments: --input, --sf-org, --sf-token');
  }

  const objectName = process.env.FINDINGS_OBJECT || 'GitHub_Workflow_Finding__c';
  const orgJson = JSON.parse(fs.readFileSync(sfOrgPath, 'utf8'));
  const tokenJson = JSON.parse(fs.readFileSync(sfTokenPath, 'utf8'));
  const findings = fs.existsSync(inputPath) ? JSON.parse(fs.readFileSync(inputPath, 'utf8')) : [];

  if (!Array.isArray(findings) || findings.length === 0) {
    console.log('No analyzer findings to upsert.');
    return;
  }

  const instanceUrl = String(orgJson?.result?.instanceUrl || '').trim();
  const accessToken = String(tokenJson?.result?.accessToken || '').trim();
  const runId = String(process.env.GITHUB_RUN_ID || '').trim();
  const runNumber = String(process.env.GITHUB_RUN_NUMBER || '').trim();
  const branch = String(process.env.BRANCH_NAME || '').trim();
  const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
  const runUrl = `https://github.com/${repository}/actions/runs/${runId}`;

  if (!instanceUrl || !accessToken || !runId) {
    throw new Error('Missing Salesforce connection details or GitHub run context for findings sync.');
  }

  const findingsWithKeys = attachStableKeys(runId, findings);
  const existingRecords = await queryExistingFindings({ objectName, instanceUrl, accessToken, runId });
  const existingByKey = new Map(existingRecords.map((record) => [String(record.Finding_Key__c || ''), String(record.Id || '')]));
  const activeKeys = new Set(findingsWithKeys.map((finding) => finding.key));

  for (let i = 0; i < findingsWithKeys.length; i += 1) {
    await upsertFinding({
      objectName,
      instanceUrl,
      accessToken,
      runId,
      runNumber,
      branch,
      repository,
      runUrl,
      finding: findingsWithKeys[i],
      index: i
    });
  }

  for (const [key, id] of existingByKey.entries()) {
    if (key && id && !activeKeys.has(key)) {
      await deleteFinding({ instanceUrl, accessToken, objectName, id });
    }
  }

  console.log(`Upserted ${findingsWithKeys.length} analyzer findings into Salesforce.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
