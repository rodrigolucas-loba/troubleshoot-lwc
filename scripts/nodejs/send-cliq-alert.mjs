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
  const notifyAllRuns = String(process.env.CLIQ_NOTIFY_ALL_RUNS || 'true') === 'true';
  const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
  const runId = String(process.env.GITHUB_RUN_ID || '').trim();
  const runUrl = repository && runId ? `https://github.com/${repository}/actions/runs/${runId}` : '';

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

  const thresholdTriggered =
    Number(summary.criticalFindings || 0) > 0 ||
    Number(summary.highFindings || 0) >= thresholdHigh ||
    Boolean(insights.blocking);
  const shouldAlert = notifyAllRuns || thresholdTriggered;

  const status = {
    channel: 'Cliq',
    shouldAlert,
    sent: false,
    httpCode: null,
    reason: shouldAlert ? '' : 'Limiares nao atingidos',
    notifyAllRuns,
    thresholdTriggered
  };

  if (!shouldAlert || !webhookUrl) {
    if (!webhookUrl) {
      status.reason = 'Webhook nao configurado';
    }
    ensureDir(outputPath);
    fs.writeFileSync(outputPath, `${JSON.stringify(status, null, 2)}\n`);
    return;
  }

  const lines = [
    notifyAllRuns ? `Nova run analisada no GitHub` : `Alerta do GitHub Analyzer`,
    repository ? `Repositorio: ${repository}` : '',
    `Branch: ${summary.branch || '-'}`,
    `Nivel de risco: ${insights.riskLevel || '-'}`,
    `Impede avanco: ${insights.blocking ? 'sim' : 'nao'}`,
    `Findings: total ${summary.totalFindings || 0} | high ${summary.highFindings || 0} | critical ${summary.criticalFindings || 0}`,
    runUrl ? `Execucao: ${runUrl}` : '',
    '',
    `Resumo: ${insights.summary || '-'}`,
    `Acao recomendada: ${insights.recommendedAction || '-'}`,
  ];

  if (Array.isArray(insights.topIssues) && insights.topIssues.length) {
    lines.push('', 'Principais problemas:');
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
  status.reason = response.ok ? '' : `Webhook respondeu com HTTP ${response.status}`;

  ensureDir(outputPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(status, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
