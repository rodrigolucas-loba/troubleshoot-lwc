public with sharing class GitHubWorkflowMetricsDashboardController {
    public class DashboardData {
        @AuraEnabled public Integer totalRuns;
        @AuraEnabled public Decimal totalFindings;
        @AuraEnabled public Decimal highFindings;
        @AuraEnabled public Decimal criticalFindings;
        @AuraEnabled public String latestBranch;
        @AuraEnabled public String latestRepository;
        @AuraEnabled public String latestConclusion;
        @AuraEnabled public Datetime latestCreatedDate;
        @AuraEnabled public String latestAiSummary;
        @AuraEnabled public String latestAiRiskLevel;
        @AuraEnabled public Boolean latestAiBlocking;
        @AuraEnabled public String latestAiRecommendedAction;
        @AuraEnabled public String latestAiTopIssues;
        @AuraEnabled public Boolean latestAiAlertSent;
        @AuraEnabled public String latestAiAlertChannel;
        @AuraEnabled public List<BranchMetric> branchMetrics;
        @AuraEnabled public List<RepositoryMetric> repositoryMetrics;
        @AuraEnabled public List<ConclusionMetric> conclusionMetrics;
        @AuraEnabled public List<RecentRun> recentRuns;
        @AuraEnabled public List<RecentFinding> latestFindings;
    }

    public class BranchMetric {
        @AuraEnabled public String branch;
        @AuraEnabled public Integer runs;
        @AuraEnabled public Decimal findings;
        @AuraEnabled public Decimal highFindings;
        @AuraEnabled public Decimal criticalFindings;
    }

    public class ConclusionMetric {
        @AuraEnabled public String conclusion;
        @AuraEnabled public Integer runs;
    }

    public class RepositoryMetric {
        @AuraEnabled public String repository;
        @AuraEnabled public Integer runs;
        @AuraEnabled public Decimal findings;
    }

    public class RecentRun {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String branch;
        @AuraEnabled public String repository;
        @AuraEnabled public Decimal runNumber;
        @AuraEnabled public String workflowName;
        @AuraEnabled public Decimal totalFindings;
        @AuraEnabled public Decimal highFindings;
        @AuraEnabled public Decimal criticalFindings;
        @AuraEnabled public String status;
        @AuraEnabled public String conclusion;
        @AuraEnabled public String triggeredBy;
        @AuraEnabled public Datetime createdDate;
        @AuraEnabled public String runUrl;
        @AuraEnabled public String aiRiskLevel;
        @AuraEnabled public Boolean aiBlocking;
        @AuraEnabled public Boolean aiAlertSent;
        @AuraEnabled public String aiAlertChannel;
    }

    public class RecentFinding {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String severity;
        @AuraEnabled public String rule;
        @AuraEnabled public String message;
        @AuraEnabled public String location;
        @AuraEnabled public String runUrl;
    }

    @AuraEnabled(cacheable=true)
    public static DashboardData getDashboardData() {
        DashboardData data = new DashboardData();
        data.branchMetrics = new List<BranchMetric>();
        data.repositoryMetrics = new List<RepositoryMetric>();
        data.conclusionMetrics = new List<ConclusionMetric>();
        data.recentRuns = new List<RecentRun>();
        data.latestFindings = new List<RecentFinding>();

        AggregateResult totals = [
            SELECT COUNT(Id) totalRuns,
                   SUM(Total_Findings__c) totalFindings,
                   SUM(High_Findings__c) highFindings,
                   SUM(Critical_Findings__c) criticalFindings
            FROM GitHub_Workflow_Metric__c
        ];

        data.totalRuns = (Integer) totals.get('totalRuns');
        data.totalFindings = decimalOrZero(totals.get('totalFindings'));
        data.highFindings = decimalOrZero(totals.get('highFindings'));
        data.criticalFindings = decimalOrZero(totals.get('criticalFindings'));

        String latestRunId;
        List<GitHub_Workflow_Metric__c> latestRuns = [
            SELECT Run_Id__c, Branch__c, Repository__c, Conclusion__c, CreatedDate,
                   Ai_Summary__c, Ai_Risk_Level__c, Ai_Blocking__c,
                   Ai_Recommended_Action__c, Ai_Top_Issues__c, Ai_Alert_Sent__c,
                   Ai_Alert_Channel__c
            FROM GitHub_Workflow_Metric__c
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];
        if (!latestRuns.isEmpty()) {
            GitHub_Workflow_Metric__c latest = latestRuns[0];
            latestRunId = latest.Run_Id__c;
            data.latestBranch = latest.Branch__c;
            data.latestRepository = latest.Repository__c;
            data.latestConclusion = latest.Conclusion__c;
            data.latestCreatedDate = latest.CreatedDate;
            data.latestAiSummary = latest.Ai_Summary__c;
            data.latestAiRiskLevel = latest.Ai_Risk_Level__c;
            data.latestAiBlocking = latest.Ai_Blocking__c;
            data.latestAiRecommendedAction = latest.Ai_Recommended_Action__c;
            data.latestAiTopIssues = latest.Ai_Top_Issues__c;
            data.latestAiAlertSent = latest.Ai_Alert_Sent__c;
            data.latestAiAlertChannel = latest.Ai_Alert_Channel__c;
        }

        if (String.isNotBlank(latestRunId)) {
            for (GitHub_Workflow_Finding__c finding : [
                SELECT Id, Name, Severity__c, Rule__c, Message__c, Location__c, Run_Url__c
                FROM GitHub_Workflow_Finding__c
                WHERE Workflow_Run_Id__c = :latestRunId
                ORDER BY CreatedDate DESC
                LIMIT 25
            ]) {
                RecentFinding item = new RecentFinding();
                item.id = finding.Id;
                item.name = finding.Name;
                item.severity = finding.Severity__c;
                item.rule = finding.Rule__c;
                item.message = finding.Message__c;
                item.location = finding.Location__c;
                item.runUrl = finding.Run_Url__c;
                data.latestFindings.add(item);
            }
        }

        for (AggregateResult result : [
            SELECT Branch__c branch,
                   COUNT(Id) runs,
                   SUM(Total_Findings__c) findings,
                   SUM(High_Findings__c) highFindings,
                   SUM(Critical_Findings__c) criticalFindings
            FROM GitHub_Workflow_Metric__c
            GROUP BY Branch__c
            ORDER BY SUM(Total_Findings__c) DESC NULLS LAST
            LIMIT 10
        ]) {
            BranchMetric metric = new BranchMetric();
            metric.branch = (String) result.get('branch');
            metric.runs = (Integer) result.get('runs');
            metric.findings = decimalOrZero(result.get('findings'));
            metric.highFindings = decimalOrZero(result.get('highFindings'));
            metric.criticalFindings = decimalOrZero(result.get('criticalFindings'));
            data.branchMetrics.add(metric);
        }

        for (AggregateResult result : [
            SELECT Conclusion__c conclusion, COUNT(Id) runs
            FROM GitHub_Workflow_Metric__c
            GROUP BY Conclusion__c
            ORDER BY COUNT(Id) DESC
        ]) {
            ConclusionMetric metric = new ConclusionMetric();
            metric.conclusion = (String) result.get('conclusion');
            metric.runs = (Integer) result.get('runs');
            data.conclusionMetrics.add(metric);
        }

        for (AggregateResult result : [
            SELECT Repository__c repository,
                   COUNT(Id) runs,
                   SUM(Total_Findings__c) findings
            FROM GitHub_Workflow_Metric__c
            GROUP BY Repository__c
            ORDER BY SUM(Total_Findings__c) DESC NULLS LAST
            LIMIT 10
        ]) {
            RepositoryMetric metric = new RepositoryMetric();
            metric.repository = (String) result.get('repository');
            metric.runs = (Integer) result.get('runs');
            metric.findings = decimalOrZero(result.get('findings'));
            data.repositoryMetrics.add(metric);
        }

        for (GitHub_Workflow_Metric__c run : [
            SELECT Id, Name, Branch__c, Repository__c, Run_Number__c, Workflow_Name__c,
                   Total_Findings__c, High_Findings__c, Critical_Findings__c, Status__c,
                   Conclusion__c, Triggered_By__c, CreatedDate, Run_Url__c,
                   Ai_Risk_Level__c, Ai_Blocking__c, Ai_Alert_Sent__c, Ai_Alert_Channel__c
            FROM GitHub_Workflow_Metric__c
            ORDER BY CreatedDate DESC
            LIMIT 10
        ]) {
            RecentRun item = new RecentRun();
            item.id = run.Id;
            item.name = run.Name;
            item.branch = run.Branch__c;
            item.repository = run.Repository__c;
            item.runNumber = run.Run_Number__c;
            item.workflowName = run.Workflow_Name__c;
            item.totalFindings = run.Total_Findings__c;
            item.highFindings = run.High_Findings__c;
            item.criticalFindings = run.Critical_Findings__c;
            item.status = run.Status__c;
            item.conclusion = run.Conclusion__c;
            item.triggeredBy = run.Triggered_By__c;
            item.createdDate = run.CreatedDate;
            item.runUrl = run.Run_Url__c;
            item.aiRiskLevel = run.Ai_Risk_Level__c;
            item.aiBlocking = run.Ai_Blocking__c;
            item.aiAlertSent = run.Ai_Alert_Sent__c;
            item.aiAlertChannel = run.Ai_Alert_Channel__c;
            data.recentRuns.add(item);
        }

        return data;
    }

    private static Decimal decimalOrZero(Object value) {
        return value == null ? 0 : (Decimal) value;
    }
}
