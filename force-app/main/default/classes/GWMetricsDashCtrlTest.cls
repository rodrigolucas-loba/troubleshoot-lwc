@IsTest
private class GWMetricsDashCtrlTest {
    @IsTest
    static void returnsDashboardData() {
        List<GitHub_Workflow_Metric__c> metrics = new List<GitHub_Workflow_Metric__c>{
            new GitHub_Workflow_Metric__c(
                Name = 'Run A',
                Branch__c = 'WI-000001',
                Repository__c = 'repo/a',
                Run_Number__c = 1,
                Workflow_Name__c = 'Analyzer',
                Total_Findings__c = 10,
                High_Findings__c = 2,
                Critical_Findings__c = 1,
                Status__c = 'success',
                Conclusion__c = 'failure',
                Triggered_By__c = 'user1',
                Run_Id__c = 'run-a',
                Ai_Risk_Level__c = 'critical',
                Ai_Blocking__c = true,
                Ai_Summary__c = 'Run A is blocking because critical findings exist.',
                Ai_Recommended_Action__c = 'Fix the critical findings before merge.',
                Ai_Top_Issues__c = 'Critical | apex | Example issue',
                Ai_Alert_Sent__c = true,
                Ai_Alert_Channel__c = 'Cliq'
            ),
            new GitHub_Workflow_Metric__c(
                Name = 'Run B',
                Branch__c = 'WI-000002',
                Repository__c = 'repo/a',
                Run_Number__c = 2,
                Workflow_Name__c = 'Analyzer',
                Total_Findings__c = 5,
                High_Findings__c = 1,
                Critical_Findings__c = 0,
                Status__c = 'success',
                Conclusion__c = 'success',
                Triggered_By__c = 'user2',
                Run_Id__c = 'run-b',
                Ai_Risk_Level__c = 'low',
                Ai_Blocking__c = false,
                Ai_Summary__c = 'Run B can proceed.',
                Ai_Recommended_Action__c = 'No blocking issues.',
                Ai_Top_Issues__c = '',
                Ai_Alert_Sent__c = false,
                Ai_Alert_Channel__c = ''
            )
        };
        insert metrics;
        Test.setCreatedDate(metrics[0].Id, Datetime.newInstance(2026, 6, 1, 10, 0, 0));
        Test.setCreatedDate(metrics[1].Id, Datetime.newInstance(2026, 6, 1, 11, 0, 0));

        List<GitHub_Workflow_Finding__c> findings = new List<GitHub_Workflow_Finding__c>{
            new GitHub_Workflow_Finding__c(
                Name = 'Finding A',
                Finding_Key__c = 'run-b-1',
                Workflow_Run_Id__c = 'run-b',
                Workflow_Run_Number__c = 2,
                Branch__c = 'WI-000002',
                Repository__c = 'repo/a',
                Severity__c = '2',
                Rule__c = 'apex:SecurityRule',
                Message__c = 'Example issue',
                Location__c = 'force-app/main/default/classes/MyClass.cls:10',
                Run_Url__c = 'https://example.test/run-b'
            )
        };
        insert findings;
        Test.setCreatedDate(findings[0].Id, Datetime.newInstance(2026, 6, 1, 11, 5, 0));

        Test.startTest();
        GitHubWorkflowMetricsDashboardController.DashboardData data =
            GitHubWorkflowMetricsDashboardController.getDashboardData();
        Test.stopTest();

        System.assertEquals(2, data.totalRuns);
        System.assertEquals(15, data.totalFindings);
        System.assertEquals(3, data.highFindings);
        System.assertEquals(1, data.criticalFindings);
        System.assertEquals(2, data.branchMetrics.size());
        System.assertEquals(1, data.repositoryMetrics.size());
        System.assertEquals(2, data.conclusionMetrics.size());
        System.assertEquals(2, data.recentRuns.size());
        System.assertEquals('low', data.latestAiRiskLevel);
        System.assertEquals(false, data.latestAiBlocking);
        System.assertEquals('Run B can proceed.', data.latestAiSummary);
        System.assertEquals(1, data.latestFindings.size());
        System.assertEquals('apex:SecurityRule', data.latestFindings[0].rule);
    }
}
