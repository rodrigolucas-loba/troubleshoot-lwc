import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

function getArg(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function translateIssueText(value) {
  return String(value || '')
    .replaceAll('Missing ApexDoc comment', 'Falta comentario ApexDoc')
    .replaceAll('The annotation @isTest should be in PascalCase: @IsTest', 'A anotacao @isTest deve estar em PascalCase: @IsTest')
    .replaceAll('Apex unit test classes should have at least one System.runAs() call', 'Classes de teste Apex devem ter pelo menos uma chamada a System.runAs()')
    .replaceAll('Avoid SOQL queries without a where or limit statement', 'Evitar queries SOQL sem clausula where ou limit')
    .replaceAll('Validate CRUD permission before SOQL/DML operation or enforce user mode', 'Validar permissao CRUD antes de operacoes SOQL/DML ou impor user mode')
    .trim();
}

function buildFallback(summary) {
  const critical = Number(summary.criticalFindings || 0);
  const high = Number(summary.highFindings || 0);
  const total = Number(summary.totalFindings || 0);
  const riskLevel = critical > 0 ? 'critical' : high > 0 ? 'high' : total > 0 ? 'medium' : 'low';
  const blocking = critical > 0;
  const recommendedAction = critical > 0
    ? 'Corrigir os findings criticos antes do merge ou promotion.'
    : high > 0
      ? 'Priorizar os findings high e validar o impacto antes do merge.'
      : total > 0
        ? 'Rever os findings moderados e baixos para limpar a branch.'
        : 'Sem findings relevantes. O run pode avancar.';
  const topIssues = Array.isArray(summary.topIssues)
    ? summary.topIssues.slice(0, 5).map((item) => {
      const message = translateIssueText(item.message || '-');
      return `Severidade ${item.severity || '-'} | Regra ${item.rule || '-'} | ${message}`.trim();
    })
    : [];

  return {
    summary: `Run do analyzer na branch ${summary.branch || '-'} com ${total} findings, ${high} high e ${critical} critical.`,
    riskLevel,
    blocking,
    recommendedAction,
    topIssues
  };
}

function stripMarkdownFence(value) {
  return String(value || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function normalizeAiResult(candidate, fallback) {
  const risk = String(candidate.riskLevel || fallback.riskLevel || 'medium').toLowerCase();
  return {
    summary: String(candidate.summary || fallback.summary || '').trim().slice(0, 1000),
    riskLevel: ['low', 'medium', 'high', 'critical'].includes(risk) ? risk : fallback.riskLevel,
    blocking: typeof candidate.blocking === 'boolean' ? candidate.blocking : fallback.blocking,
    recommendedAction: String(candidate.recommendedAction || fallback.recommendedAction || '').trim().slice(0, 1000),
    topIssues: Array.isArray(candidate.topIssues)
      ? candidate.topIssues.map((item) => translateIssueText(item)).filter(Boolean).slice(0, 5)
      : fallback.topIssues
  };
}

function toMarkdown(ai) {
  const lines = [
    '## Insights Gemini',
    '',
    `- Nivel de risco: **${ai.riskLevel}**`,
    `- Bloqueante: **${ai.blocking ? 'sim' : 'nao'}**`,
    '',
    '**Resumo**',
    ai.summary,
    '',
    '**Acao recomendada**',
    ai.recommendedAction
  ];

  if (ai.topIssues.length) {
    lines.push('', '**Principais issues**');
    for (const issue of ai.topIssues) {
      lines.push(`- ${issue}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const inputPath = getArg('--input');
  const outputPath = getArg('--output');
  const markdownPath = getArg('--markdown');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const apiKey = process.env.GEMINI_API_KEY || '';
  const maxRetries = Number(process.env.GEMINI_MAX_RETRIES || 4);

  if (!inputPath || !outputPath || !markdownPath) {
    throw new Error('Missing required arguments: --input, --output, --markdown');
  }

  const summary = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const fallback = buildFallback(summary);
  let finalResult = fallback;

  if (apiKey) {
    const prompt = [
      'Estas a analisar findings do Salesforce Code Analyzer de um run do GitHub Actions.',
      'Responde SEMPRE em portugues de Portugal.',
      'Devolve APENAS JSON valido com estas chaves:',
      'summary: string',
      'riskLevel: one of low, medium, high, critical',
      'blocking: boolean',
      'recommendedAction: string',
      'topIssues: array of ate 5 strings curtas em portugues de Portugal',
      '',
      'Interpreta os findings de forma pragmatica.',
      'Qualquer finding critical deve ser tratado como bloqueante.',
      'Se existirem apenas findings high, blocking pode ser false se a alteracao puder avancar com follow-up posterior.',
      'Mantem riskLevel com um destes valores exatos: low, medium, high, critical.',
      '',
      `Branch: ${summary.branch || '-'}`,
      `Commit: ${summary.commit || '-'}`,
      `Total findings: ${summary.totalFindings || 0}`,
      `High findings: ${summary.highFindings || 0}`,
      `Critical findings: ${summary.criticalFindings || 0}`,
      'Top issues:',
      JSON.stringify(summary.topIssues || [], null, 2)
    ].join('\n');

    let response = null;
    let lastError = '';

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2
          }
        })
      });

      if (response.ok) {
        break;
      }

      lastError = `Gemini request failed with HTTP ${response.status}`;
      const isRetryable = response.status === 429 || response.status >= 500;
      if (!isRetryable || attempt === maxRetries) {
        break;
      }

      const waitMs = Math.min(15000, 1000 * (2 ** (attempt - 1)));
      console.warn(`${lastError}. Retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})`);
      await delay(waitMs);
    }

    if (response?.ok) {
      try {
        const raw = await response.json();
        const text = raw?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
        if (text) {
          const parsed = JSON.parse(stripMarkdownFence(text));
          finalResult = normalizeAiResult(parsed, fallback);
        }
      } catch (error) {
        console.warn(`Gemini response parsing failed: ${error.message}`);
        finalResult = {
          ...fallback,
          summary: `${fallback.summary} O Gemini ficou indisponivel para parsing e foi usado fallback local.`
        };
      }
    } else if (response) {
      console.warn(lastError);
      finalResult = {
        ...fallback,
        summary: `${fallback.summary} O Gemini ficou indisponivel (HTTP ${response.status}) e foi usado fallback local.`
      };
    }
  }

  ensureDir(outputPath);
  ensureDir(markdownPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(finalResult, null, 2)}\n`);
  fs.writeFileSync(markdownPath, toMarkdown(finalResult));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
