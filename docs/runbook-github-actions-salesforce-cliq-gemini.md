# Runbook: GitHub Actions + Salesforce + Gemini + Cliq

## Objetivo

Este fluxo analisa código Salesforce no GitHub Actions com Salesforce Code Analyzer, gera um resumo com apoio de IA, grava métricas e findings no Salesforce, apresenta os resultados numa app LWC e envia uma notificação para o Cliq.

## Resultado final

No estado atual, a solução faz isto:

1. corre a workflow de analyzer no GitHub
2. gera artefactos CSV, Markdown e JSON
3. gera insights com Gemini, com fallback local se a API falhar
4. faz upsert de métricas para `GitHub_Workflow_Metric__c`
5. faz upsert de findings para `GitHub_Workflow_Finding__c`
6. mostra os dados na app `GitHub Workflow Metrics` no Salesforce
7. envia uma notificação para o Cliq via webhook

## Arquitetura

```text
Git push / PR
  -> GitHub Actions workflow
     -> Salesforce Code Analyzer
     -> summary JSON + findings JSON
     -> Gemini insights / fallback local
     -> upsert para Salesforce
     -> alerta Cliq
     -> dashboard LWC no Salesforce
```

## Ficheiros principais

### Workflow

- [.codex-wi-009999/.github/workflows/salesforce-code-analyzer.yml](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\.github\workflows\salesforce-code-analyzer.yml)

### Scripts Node.js

- [.codex-wi-009999/scripts/nodejs/generate-gemini-insights.mjs](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\scripts\nodejs\generate-gemini-insights.mjs)
- [.codex-wi-009999/scripts/nodejs/upsert-analyzer-findings.mjs](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\scripts\nodejs\upsert-analyzer-findings.mjs)
- [.codex-wi-009999/scripts/nodejs/send-cliq-alert.mjs](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\scripts\nodejs\send-cliq-alert.mjs)

### Salesforce metadata

- [.codex-wi-009999/force-app/main/default/objects/GitHub_Workflow_Metric__c/GitHub_Workflow_Metric__c.object-meta.xml](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\force-app\main\default\objects\GitHub_Workflow_Metric__c\GitHub_Workflow_Metric__c.object-meta.xml)
- [.codex-wi-009999/force-app/main/default/objects/GitHub_Workflow_Finding__c/GitHub_Workflow_Finding__c.object-meta.xml](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\force-app\main\default\objects\GitHub_Workflow_Finding__c\GitHub_Workflow_Finding__c.object-meta.xml)
- [.codex-wi-009999/force-app/main/default/classes/GitHubWorkflowMetricsDashboardController.cls](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\force-app\main\default\classes\GitHubWorkflowMetricsDashboardController.cls)
- [.codex-wi-009999/force-app/main/default/lwc/githubWorkflowMetricsDashboard/githubWorkflowMetricsDashboard.js](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\force-app\main\default\lwc\githubWorkflowMetricsDashboard\githubWorkflowMetricsDashboard.js)
- [.codex-wi-009999/force-app/main/default/lwc/githubWorkflowMetricsDashboard/githubWorkflowMetricsDashboard.html](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\force-app\main\default\lwc\githubWorkflowMetricsDashboard\githubWorkflowMetricsDashboard.html)
- [.codex-wi-009999/force-app/main/default/permissionsets/GitHub_Workflow_Metrics_Integration.permissionset-meta.xml](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\force-app\main\default\permissionsets\GitHub_Workflow_Metrics_Integration.permissionset-meta.xml)
- [.codex-wi-009999/force-app/main/default/applications/GitHub_Workflow_Metrics.app-meta.xml](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\force-app\main\default\applications\GitHub_Workflow_Metrics.app-meta.xml)
- [.codex-wi-009999/force-app/main/default/flexipages/GitHub_Workflow_Metrics_Dashboard.flexipage-meta.xml](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\force-app\main\default\flexipages\GitHub_Workflow_Metrics_Dashboard.flexipage-meta.xml)
- [.codex-wi-009999/force-app/main/default/tabs/GitHub_Workflow_Metrics_Dashboard.tab-meta.xml](c:\Users\rodri\Desktop\troubleshoot-lwc\.codex-wi-009999\force-app\main\default\tabs\GitHub_Workflow_Metrics_Dashboard.tab-meta.xml)

## Secrets necessários no GitHub

No repositório GitHub:

- `SF_AUTH_URL_METRICS`
- `GEMINI_API_KEY`
- `CLIQ_BOT_WEBHOOK_URL`

### `SF_AUTH_URL_METRICS`

SFDX auth URL de um utilizador Salesforce com:

- `API Enabled`
- acesso aos objetos `GitHub_Workflow_Metric__c` e `GitHub_Workflow_Finding__c`
- permission set `GitHub Workflow Metrics Integration`

### `GEMINI_API_KEY`

API key do Gemini. O fluxo atual usa:

- `gemini-2.5-flash`

Nota:

- se o Gemini falhar com `429` ou `503`, o workflow usa fallback local
- isso não bloqueia a pipeline

### `CLIQ_BOT_WEBHOOK_URL`

Webhook completo do Cliq.

Pode ser:

- webhook do bot, se quiseres que a mensagem apareça como bot
- webhook do canal, se quiseres publicar diretamente no canal

Regra prática:

- trocar o valor deste secret muda o remetente/destino sem alterar código

## Variáveis relevantes da workflow

No topo da workflow:

- `FAIL_ON_CRITICAL: "true"`
- `SF_METRICS_OBJECT: "GitHub_Workflow_Metric__c"`
- `GEMINI_MODEL: "gemini-2.5-flash"`
- `CLIQ_ALERT_THRESHOLD_HIGH: "3"`
- `CLIQ_NOTIFY_ALL_RUNS: "true"`

## Como a workflow funciona

### 1. Analyzer

A workflow corre em:

- `push` para branches `WI-*`
- `push` para `github-workflow-metrics`
- `pull_request`
- `workflow_dispatch`

Executa:

- `sf code-analyzer run`

Output:

- `docs/code-analyzer-report.csv`

### 2. Summary e findings

A step PowerShell transforma o CSV em:

- `docs/code-analyzer-report.md`
- `docs/code-analyzer-pr-comment.md`
- `docs/code-analyzer-summary.json`
- `docs/code-analyzer-findings.json`

### 3. Insights com Gemini

O script:

- lê `docs/code-analyzer-summary.json`
- pede resposta em pt-PT
- normaliza `riskLevel` para `low|medium|high|critical`
- faz retry em `429` e `5xx`
- usa fallback local se necessário

Output:

- `docs/code-analyzer-ai.json`
- `docs/code-analyzer-ai-summary.md`

### 4. Persistência no Salesforce

#### Métricas

Upsert para `GitHub_Workflow_Metric__c` usando:

- external ID `Run_Id__c`

Campos principais gravados:

- branch
- repository
- run id
- run number
- run URL
- commit SHA
- status
- conclusion
- findings totais
- findings high
- findings critical
- summary AI
- risk AI
- ação recomendada AI
- top issues AI
- modelo AI
- estado de alerta Cliq

#### Findings

Upsert para `GitHub_Workflow_Finding__c` usando:

- external ID `Finding_Key__c`

Campos principais:

- `Workflow_Run_Id__c`
- `Workflow_Run_Number__c`
- `Branch__c`
- `Repository__c`
- `Severity__c`
- `Rule__c`
- `Message__c`
- `Location__c`
- `Run_Url__c`

### 5. Alerta Cliq

O script do Cliq:

- lê `summary.json`
- lê `ai.json`
- decide se deve enviar alerta
- no estado atual envia para todos os runs porque:
  - `CLIQ_NOTIFY_ALL_RUNS = true`

Output local:

- `docs/cliq-alert-status.json`

Se o envio for aceite:

- `Ai_Alert_Sent__c = true`
- `Ai_Alert_Channel__c = Cliq`

## Salesforce: deploy e app

### Deploy

Deploy típico:

```powershell
sf project deploy start --target-org dev --source-dir .codex-wi-009999/force-app/main/default
```

Ou deploy mínimo da dashboard:

```powershell
sf project deploy start --target-org dev `
  --source-dir .codex-wi-009999/force-app/main/default/applications/GitHub_Workflow_Metrics.app-meta.xml `
  --source-dir .codex-wi-009999/force-app/main/default/flexipages/GitHub_Workflow_Metrics_Dashboard.flexipage-meta.xml `
  --source-dir .codex-wi-009999/force-app/main/default/tabs/GitHub_Workflow_Metrics_Dashboard.tab-meta.xml `
  --source-dir .codex-wi-009999/force-app/main/default/classes/GitHubWorkflowMetricsDashboardController.cls `
  --source-dir .codex-wi-009999/force-app/main/default/classes/GWMetricsDashCtrlTest.cls `
  --source-dir .codex-wi-009999/force-app/main/default/lwc/githubWorkflowMetricsDashboard `
  --test-level RunSpecifiedTests `
  --tests GWMetricsDashCtrlTest
```

### App e dashboard

App:

- `GitHub Workflow Metrics`

Tab da dashboard:

- `GitHub Workflow Metrics Dashboard`

Objetos:

- `GitHub Workflow Metrics`
- `GitHub Workflow Findings` via dashboard/controller

### Permission set

O permission set `GitHub Workflow Metrics Integration` precisa de:

- acesso aos dois objetos
- visibilidade à app `GitHub_Workflow_Metrics`
- visibilidade ao tab `GitHub_Workflow_Metrics_Dashboard`
- visibilidade ao tab `GitHub_Workflow_Metric__c`

## Como testar

### Teste completo

1. confirmar secrets no GitHub
2. fazer `push` para uma branch `WI-*`
3. abrir o run no GitHub Actions
4. validar os steps:
   - `Generate Gemini insights`
   - `Upsert workflow metrics to Salesforce`
   - `Upsert analyzer findings to Salesforce`
   - `Send Cliq alert`
   - `Update alert status in Salesforce`
5. validar no Salesforce:
   - novo registo em `GitHub_Workflow_Metric__c`
   - findings ligados por `Workflow_Run_Id__c`
   - app `GitHub Workflow Metrics Dashboard`
6. validar no Cliq:
   - mensagem recebida no destino escolhido

### Queries úteis

Últimos runs:

```powershell
sf data query --target-org dev --query "SELECT Name, Run_Number__c, Ai_Alert_Sent__c, Ai_Alert_Channel__c, Ai_Risk_Level__c, CreatedDate FROM GitHub_Workflow_Metric__c ORDER BY CreatedDate DESC LIMIT 5"
```

Últimos findings:

```powershell
sf data query --target-org dev --query "SELECT Name, Severity__c, Rule__c, Message__c, Location__c, Workflow_Run_Number__c, Branch__c, CreatedDate FROM GitHub_Workflow_Finding__c ORDER BY CreatedDate DESC LIMIT 20"
```

## Troubleshooting

### 1. Workflow não dispara

Causa comum:

- `push` sem alteração real em ficheiros relevantes

Nota:

- a workflow usa `paths-ignore`
- commits vazios não bastam se não houver ficheiros alterados

### 2. `INVALID_AUTH_HEADER`

Causa comum:

- token Salesforce mal resolvido

Fix:

- garantir leitura de `sf org auth show-access-token`
- garantir que `SF_AUTH_URL_METRICS` é válido

### 3. `The Finding_Key__c field should not be specified in the sobject data`

Causa:

- enviar `Finding_Key__c` no body do PATCH

Fix já aplicado:

- usar `Finding_Key__c` apenas no URL de upsert

### 4. App existe mas não aparece no launcher

Causas comuns:

- app sem visibilidade no permission set
- tab da dashboard sem visibilidade
- cache do Lightning

Fix:

- garantir `applicationVisibilities` e `tabSettings` no permission set
- fazer hard refresh

### 5. Cliq não recebe mensagem

Checklist:

1. confirmar que `Send Cliq alert` ficou verde
2. confirmar no Salesforce:
   - `Ai_Alert_Sent__c = true`
3. confirmar o webhook usado:
   - bot endpoint -> aparece como bot
   - channel endpoint -> aparece em nome do utilizador/token

### 6. Gemini responde em inglês ou mistura idiomas

Fix já aplicado:

- prompt em pt-PT
- fallback em pt-PT
- mensagem Cliq em pt-PT

### 7. Gemini falha com `429` ou `503`

Comportamento esperado:

- retry automático
- fallback local
- workflow continua

## Decisões tomadas nesta implementação

### Gemini

- modelo atual: `gemini-2.5-flash`
- motivo: tinha quota disponível no nível gratuito

### Cliq

- o secret mantém o nome `CLIQ_BOT_WEBHOOK_URL`
- o valor pode apontar para bot ou canal
- isso permite trocar remetente/destino sem alterar a workflow

### Salesforce

- objeto principal por run
- objeto separado para findings
- dashboard LWC lê o último run e os findings associados

## Estado atual da POC

Esta POC está funcional de ponta a ponta:

- analyzer
- summary
- insights AI
- fallback local
- persistência Salesforce
- dashboard LWC
- alerta Cliq

O que fica como melhoria futura:

- tornar labels `high` / `critical` totalmente traduzidos
- guardar `AI source` e `AI error code` no Salesforce
- diferenciar mensagem curta de canal e mensagem longa de detalhe
- fechar documentação final fora da branch técnica, se necessário
