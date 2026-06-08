import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import getDashboardData from '@salesforce/apex/GitHubWorkflowMetricsDashboardController.getDashboardData';

const COLUMNS = [
    {
        label: 'Name',
        fieldName: 'recordUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'name' }, target: '_self' }
    },
    { label: 'Branch', fieldName: 'branch' },
    { label: 'Repository', fieldName: 'repository' },
    { label: 'Run #', fieldName: 'runNumber', type: 'number' },
    { label: 'Findings', fieldName: 'totalFindings', type: 'number' },
    { label: 'High', fieldName: 'highFindings', type: 'number' },
    { label: 'Critical', fieldName: 'criticalFindings', type: 'number' },
    { label: 'Status', fieldName: 'status' },
    { label: 'Conclusion', fieldName: 'conclusion' },
    { label: 'AI Risk', fieldName: 'aiRiskLevel' },
    { label: 'AI Blocking', fieldName: 'aiBlocking', type: 'boolean' },
    { label: 'Alert Sent', fieldName: 'aiAlertSent', type: 'boolean' },
    { label: 'Alert Channel', fieldName: 'aiAlertChannel' },
    { label: 'Triggered By', fieldName: 'triggeredBy' },
    { label: 'Created', fieldName: 'createdDate', type: 'date' },
    { label: 'Run URL', fieldName: 'runUrl', type: 'url', typeAttributes: { label: { fieldName: 'runUrl' }, target: '_blank' } }
];

export default class GithubWorkflowMetricsDashboard extends NavigationMixin(LightningElement) {
    columns = COLUMNS;
    summary = {};
    branchMetrics = [];
    repositoryMetrics = [];
    conclusionMetrics = [];
    recentRuns = [];
    errorMessage;
    isLoading = true;
    wiredResponse;

    @wire(getDashboardData)
    wiredData(response) {
        this.wiredResponse = response;
        const { error, data } = response;
        this.isLoading = false;

        if (data) {
            this.errorMessage = undefined;
            this.summary = {
                totalRuns: data.totalRuns ?? 0,
                totalFindings: data.totalFindings ?? 0,
                highFindings: data.highFindings ?? 0,
                criticalFindings: data.criticalFindings ?? 0,
                latestBranch: data.latestBranch || '-',
                latestRepository: data.latestRepository || '-',
                latestConclusion: data.latestConclusion || '-',
                latestCreatedDate: data.latestCreatedDate || '-',
                latestAiSummary: data.latestAiSummary || '',
                latestAiRiskLevel: data.latestAiRiskLevel || '-',
                latestAiBlocking: data.latestAiBlocking ?? false,
                latestAiRecommendedAction: data.latestAiRecommendedAction || '',
                latestAiTopIssues: data.latestAiTopIssues || '',
                latestAiAlertSent: data.latestAiAlertSent ?? false,
                latestAiAlertChannel: data.latestAiAlertChannel || '-'
            };
            this.branchMetrics = this.withWidths(data.branchMetrics || [], 'findings');
            this.repositoryMetrics = this.withWidths(data.repositoryMetrics || [], 'findings');
            this.conclusionMetrics = this.withWidths(data.conclusionMetrics || [], 'runs');
            this.recentRuns = (data.recentRuns || []).map((item) => ({
                ...item,
                recordUrl: `/${item.id}`
            }));
        } else if (error) {
            this.errorMessage = error.body?.message || 'Erro ao carregar metricas.';
        }
    }

    get hasData() {
        return !this.isLoading && !this.errorMessage;
    }

    async handleRefresh() {
        this.isLoading = true;
        await refreshApex(this.wiredResponse);
    }

    handleOpenRecords() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'GitHub_Workflow_Metric__c',
                actionName: 'list'
            }
        });
    }

    get hasLatestAiInsights() {
        return Boolean(this.summary.latestAiSummary);
    }

    get latestAiTopIssuesList() {
        return String(this.summary.latestAiTopIssues || '')
            .split('|')
            .map((item) => item.trim())
            .filter(Boolean);
    }

    withWidths(items, key) {
        const maxValue = Math.max(...items.map((item) => Number(item[key] || 0)), 1);
        return items.map((item) => ({
            ...item,
            barStyle: `width:${Math.max((Number(item[key] || 0) / maxValue) * 100, 2)}%`
        }));
    }
}
