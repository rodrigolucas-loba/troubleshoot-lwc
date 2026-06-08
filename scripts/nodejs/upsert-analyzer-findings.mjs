import fs from 'node:fs';

function getArg(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function upsertFinding({ objectName, instanceUrl, accessToken, runId, runNumber, branch, repository, runUrl, finding, index }) {
  const key = `${runId}-${index + 1}`;
  const payload = {
    Name: `${branch} / Finding ${index + 1}`,
    Finding_Key__c: key,
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

  for (let i = 0; i < findings.length; i += 1) {
    await upsertFinding({
      objectName,
      instanceUrl,
      accessToken,
      runId,
      runNumber,
      branch,
      repository,
      runUrl,
      finding: findings[i],
      index: i
    });
  }

  console.log(`Upserted ${findings.length} analyzer findings into Salesforce.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
