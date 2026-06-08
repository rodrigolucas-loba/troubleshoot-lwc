import fs from 'node:fs';
import path from 'node:path';

function getArg(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function main() {
  const summaryPath = getArg('--summary');
  const insightsPath = getArg('--insights');
  const outputPath = getArg('--output');
  const webhookUrl = process.env.CLIQ_BOT_WEBHOOK_URL || '';
  const thresholdHigh = Number(process.env.CLIQ_ALERT_THRESHOLD_HIGH || 3);

  if (!summaryPath || !insightsPath || !outputPath) {
    throw new Error('Missing required arguments: --summary, --insights, --output');
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const insights = fs.existsSync(insightsPath)
    ? JSON.parse(fs.readFileSync(insightsPath, 'utf8'))
    : {
        summary: '',
        riskLevel: 'medium',
        blocking: false,
        recommendedAction: '',
        topIssues: []
      };

  const shouldAlert =
    Number(summary.criticalFindings || 0) > 0 ||
    Number(summary.highFindings || 0) >= thresholdHigh ||
    Boolean(insights.blocking);

  const status = {
    channel: 'Cliq',
    shouldAlert,
    sent: false,
    httpCode: null,
    reason: shouldAlert ? '' : 'Thresholds not met'
  };

  if (!shouldAlert || !webhookUrl) {
    if (!webhookUrl) {
      status.reason = 'Webhook not configured';
    }
    ensureDir(outputPath);
    fs.writeFileSync(outputPath, `${JSON.stringify(status, null, 2)}\n`);
    return;
  }

  const lines = [
    `GitHub Analyzer Alert`,
    `Branch: ${summary.branch || '-'}`,
    `Risk: ${insights.riskLevel || '-'}`,
    `Blocking: ${insights.blocking ? 'yes' : 'no'}`,
    `Findings: total ${summary.totalFindings || 0}, high ${summary.highFindings || 0}, critical ${summary.criticalFindings || 0}`,
    '',
    `Summary: ${insights.summary || '-'}`,
    `Recommended action: ${insights.recommendedAction || '-'}`,
  ];

  if (Array.isArray(insights.topIssues) && insights.topIssues.length) {
    lines.push('', 'Top issues:');
    for (const issue of insights.topIssues.slice(0, 5)) {
      lines.push(`- ${issue}`);
    }
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: lines.join('\n')
    })
  });

  status.httpCode = response.status;
  status.sent = response.ok;
  status.reason = response.ok ? '' : `Webhook responded with HTTP ${response.status}`;

  ensureDir(outputPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(status, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
