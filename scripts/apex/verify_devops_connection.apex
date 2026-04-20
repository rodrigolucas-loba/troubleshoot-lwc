// ============================================================
// DevOps Center Connection Verification Script
// ============================================================
// This script verifies the connection between your DevOps Center
// project, pipeline, and the almdevopscenter Connected App
// ============================================================

System.debug('='.repeat(60));
System.debug('DEVOPS CENTER CONNECTION VERIFICATION');
System.debug('='.repeat(60));

// STEP 1: Verify DevOps Center Projects
System.debug('\n[STEP 1] Checking DevOps Center Projects...');
List<sf_devops__Project__c> projects = [
    SELECT Id, Name, sf_devops__Repository_Id__c
    FROM sf_devops__Project__c
    ORDER BY CreatedDate DESC
    LIMIT 5
];

if (projects.isEmpty()) {
    System.debug('❌ No DevOps Center projects found!');
} else {
    System.debug('✓ Found ' + projects.size() + ' project(s):');
    for (sf_devops__Project__c proj : projects) {
        System.debug('  - ' + proj.Name + ' (ID: ' + proj.Id + ')');
        System.debug('    Repository: ' + proj.sf_devops__Repository_Id__c);
    }
}

// STEP 2: Verify Pipelines
System.debug('\n[STEP 2] Checking DevOps Pipelines...');
List<sf_devops__Pipeline__c> pipelines = [
    SELECT Id, Name, sf_devops__Project__c, sf_devops__Project__r.Name
    FROM sf_devops__Pipeline__c
    ORDER BY CreatedDate DESC
    LIMIT 5
];

if (pipelines.isEmpty()) {
    System.debug('❌ No pipelines found!');
} else {
    System.debug('✓ Found ' + pipelines.size() + ' pipeline(s):');
    for (sf_devops__Pipeline__c pipe : pipelines) {
        System.debug('  - ' + pipe.Name + ' (Project: ' + pipe.sf_devops__Project__r.Name + ')');
    }
}

// STEP 3: Verify Environments and Named Credentials
System.debug('\n[STEP 3] Checking Environments and Named Credentials...');
List<sf_devops__Environment__c> environments = [
    SELECT Id, Name, 
           sf_devops__Named_Credential__c,
           sf_devops__Org_Id__c,
           sf_devops__Can_Track_Changes__c,
           sf_devops__Project__r.Name
    FROM sf_devops__Environment__c
    ORDER BY sf_devops__Project__r.Name, Name
];

if (environments.isEmpty()) {
    System.debug('❌ No environments found!');
} else {
    System.debug('✓ Found ' + environments.size() + ' environment(s):');
    for (sf_devops__Environment__c env : environments) {
        System.debug('\n  Environment: ' + env.Name);
        System.debug('    Project: ' + env.sf_devops__Project__r.Name);
        System.debug('    Named Credential: ' + env.sf_devops__Named_Credential__c);
        System.debug('    Org ID: ' + env.sf_devops__Org_Id__c);
        System.debug('    Track Changes: ' + env.sf_devops__Can_Track_Changes__c);
        
        // Test Named Credential connection if available
        if (String.isNotBlank(env.sf_devops__Named_Credential__c)) {
            try {
                HttpRequest req = new HttpRequest();
                req.setMethod('GET');
                req.setTimeout(10000);
                req.setEndpoint(
                    'callout:' + env.sf_devops__Named_Credential__c +
                    '/services/data/v66.0/query?q=' +
                    EncodingUtil.urlEncode('SELECT Id, Name FROM Organization', 'UTF-8')
                );
                
                HttpResponse res = new Http().send(req);
                
                if (res.getStatusCode() == 200) {
                    System.debug('    ✓ Connection Status: SUCCESS (200)');
                    Map<String, Object> responseData = (Map<String, Object>)JSON.deserializeUntyped(res.getBody());
                    List<Object> records = (List<Object>)responseData.get('records');
                    if (!records.isEmpty()) {
                        Map<String, Object> org = (Map<String, Object>)records[0];
                        System.debug('    ✓ Connected to Org: ' + org.get('Name'));
                    }
                } else {
                    System.debug('    ❌ Connection Status: FAILED (' + res.getStatusCode() + ')');
                    System.debug('    Error: ' + res.getBody());
                }
            } catch (Exception e) {
                System.debug('    ❌ Connection Test Failed: ' + e.getMessage());
            }
        } else {
            System.debug('    ⚠ No Named Credential configured');
        }
    }
}

// STEP 4: Check for almdevopscenter Connected App references
System.debug('\n[STEP 4] Checking for Connected App configurations...');
System.debug('Note: External Credentials and their Connected App associations');
System.debug('must be checked manually in Setup → Named Credentials → External Credentials');
System.debug('\nLook for:');
System.debug('  - External Credentials matching your environment names');
System.debug('  - Authentication Protocol: OAuth 2.0');
System.debug('  - Connected App: almdevopscenter');

// STEP 5: Check Permission Sets
System.debug('\n[STEP 5] Checking DevOps Center Permission Sets...');
List<PermissionSet> devopsPermSets = [
    SELECT Id, Name, Label
    FROM PermissionSet
    WHERE Name LIKE 'sf_devops%'
    ORDER BY Name
];

if (devopsPermSets.isEmpty()) {
    System.debug('❌ No DevOps Center permission sets found!');
} else {
    System.debug('✓ Found ' + devopsPermSets.size() + ' DevOps Center permission set(s):');
    for (PermissionSet ps : devopsPermSets) {
        System.debug('  - ' + ps.Label + ' (' + ps.Name + ')');
    }
}

// STEP 6: Check User Assignments
System.debug('\n[STEP 6] Checking current user DevOps Center permissions...');
List<PermissionSetAssignment> userAssignments = [
    SELECT PermissionSet.Name, PermissionSet.Label
    FROM PermissionSetAssignment
    WHERE AssigneeId = :UserInfo.getUserId()
    AND PermissionSet.Name LIKE 'sf_devops%'
];

if (userAssignments.isEmpty()) {
    System.debug('⚠ Current user has no DevOps Center permission sets assigned');
} else {
    System.debug('✓ Current user has ' + userAssignments.size() + ' DevOps permission(s):');
    for (PermissionSetAssignment psa : userAssignments) {
        System.debug('  - ' + psa.PermissionSet.Label);
    }
}

// Summary and Next Steps
System.debug('\n' + '='.repeat(60));
System.debug('VERIFICATION SUMMARY');
System.debug('='.repeat(60));
System.debug('Projects: ' + projects.size());
System.debug('Pipelines: ' + pipelines.size());
System.debug('Environments: ' + environments.size());
System.debug('Permission Sets: ' + devopsPermSets.size());
System.debug('User Permissions: ' + userAssignments.size());

System.debug('\n[NEXT STEPS]');
System.debug('1. Review the connection test results above');
System.debug('2. If connections failed, check External Credentials in Setup');
System.debug('3. Ensure almdevopscenter Connected App is properly configured');
System.debug('4. Verify OAuth tokens are valid and not expired');
System.debug('5. See docs/devops-center-connection-guide.md for detailed instructions');
System.debug('='.repeat(60));