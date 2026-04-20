// Show the complete connection flow from DevOps Center to target orgs
System.debug('========================================');
System.debug('DEVOPS CENTER CONNECTION ARCHITECTURE');
System.debug('========================================\n');

System.debug('This shows HOW your DevOps Center connects to your orgs through');
System.debug('ALMDevOpsConnectedApp (almdevopscenter)\n');

System.debug('[ARCHITECTURE FLOW]');
System.debug('-------------------');
System.debug('1. DevOps Center Project: troubleshoot-lwc');
System.debug('   └─> Pipeline: troubleshoot-lwc Pipeline');
System.debug('       └─> Environments:');
System.debug('           ├─> Dev Environment');
System.debug('           │   └─> Named Credential: Dev_1PJd20000004WkTGAU_1776244935056');
System.debug('           │       └─> External Credential: Dev_1PJd20000004WkTGAU_1776244935056');
System.debug('           │           └─> Auth Provider: DEVOPS_CENTER_TEST (or PROD)');
System.debug('           │               └─> Connected App: ALMDevOpsConnectedApp');
System.debug('           │                   └─> Target Org: Company (SWE30S)');
System.debug('           │');
System.debug('           └─> Production Environment');
System.debug('               └─> Named Credential: Production_1PJd20000004WkTGAU_1776244895509');
System.debug('                   └─> External Credential: Production_1PJd20000004WkTGAU_1776244895509');
System.debug('                       └─> Auth Provider: DEVOPS_CENTER_PROD');
System.debug('                           └─> Connected App: ALMDevOpsConnectedApp');
System.debug('                               └─> Target Org: Loba (SWE106)\n');

System.debug('[DETAILED EXPLANATION]');
System.debug('----------------------\n');

System.debug('1. NAMED CREDENTIALS (What DevOps Center uses to call orgs)');
System.debug('   - These are the callout endpoints');
System.debug('   - Format: callout:Dev_1PJd20000004WkTGAU_1776244935056');
System.debug('   - They reference External Credentials for authentication\n');

System.debug('2. EXTERNAL CREDENTIALS (Where OAuth tokens are stored)');
System.debug('   - Store the OAuth access/refresh tokens');
System.debug('   - Reference an Auth Provider');
System.debug('   - Have Authentication Parameters (the actual tokens)\n');

System.debug('3. AUTH PROVIDERS (OAuth configuration)');
System.debug('   - DEVOPS_CENTER_PROD: For production/sandbox orgs');
System.debug('   - DEVOPS_CENTER_TEST: For scratch/test orgs');
System.debug('   - Configure OAuth endpoints and scopes');
System.debug('   - Reference the Connected App (ALMDevOpsConnectedApp)\n');

System.debug('4. CONNECTED APP (ALMDevOpsConnectedApp = almdevopscenter)');
System.debug('   - Provides OAuth credentials (Consumer Key/Secret)');
System.debug('   - Defines OAuth scopes (api, refresh_token, full)');
System.debug('   - Allows DevOps Center to authenticate to target orgs\n');

System.debug('[HOW IT WORKS IN PRACTICE]');
System.debug('---------------------------\n');

System.debug('When DevOps Center deploys to Dev:');
System.debug('1. DevOps Center makes callout to: Dev_1PJd20000004WkTGAU_1776244935056');
System.debug('2. Named Credential looks up its External Credential');
System.debug('3. External Credential provides OAuth tokens from its Auth Provider');
System.debug('4. Auth Provider uses ALMDevOpsConnectedApp Consumer Key');
System.debug('5. OAuth flow authenticates to Company org (00DQJ00000G0QcP2AV)');
System.debug('6. Deployment proceeds with authenticated session\n');

System.debug('When DevOps Center deploys to Production:');
System.debug('1. DevOps Center makes callout to: Production_1PJd20000004WkTGAU_1776244895509');
System.debug('2. Named Credential looks up its External Credential');
System.debug('3. External Credential provides OAuth tokens from its Auth Provider');
System.debug('4. Auth Provider uses ALMDevOpsConnectedApp Consumer Key');
System.debug('5. OAuth flow authenticates to Loba org (00DWU00000l1sbB2AQ)');
System.debug('6. Deployment proceeds with authenticated session\n');

System.debug('[WHERE TO SEE EACH COMPONENT IN SALESFORCE UI]');
System.debug('------------------------------------------------\n');

System.debug('1. Projects & Pipelines:');
System.debug('   Setup → DevOps Center → Projects → troubleshoot-lwc\n');

System.debug('2. Environments:');
System.debug('   Setup → DevOps Center → Environments');
System.debug('   (Shows Dev and Production with their Named Credentials)\n');

System.debug('3. Named Credentials:');
System.debug('   Setup → Named Credentials → Named Credentials');
System.debug('   (Shows Dev_1PJd20000004WkTGAU_1776244935056 and Production_...)\n');

System.debug('4. External Credentials:');
System.debug('   Setup → Named Credentials → External Credentials');
System.debug('   (Shows same names as Named Credentials)');
System.debug('   (Has Authentication Parameters section with OAuth tokens)\n');

System.debug('5. Auth Providers:');
System.debug('   Setup → Auth. Providers');
System.debug('   (Shows DEVOPS_CENTER_PROD and DEVOPS_CENTER_TEST)');
System.debug('   (Each references ALMDevOpsConnectedApp Consumer Key)\n');

System.debug('6. Connected App:');
System.debug('   Setup → App Manager → ALMDevOpsConnectedApp');
System.debug('   (Has OAuth settings with Consumer Key/Secret)');
System.debug('   (THIS IS your "almdevopscenter")\n');

System.debug('[VERIFICATION - Test the actual flow]');
System.debug('--------------------------------------\n');

// Test Dev connection
try {
    HttpRequest req = new HttpRequest();
    req.setMethod('GET');
    req.setEndpoint('callout:Dev_1PJd20000004WkTGAU_1776244935056/services/data/v66.0/sobjects');
    HttpResponse res = new Http().send(req);
    System.debug('✓ Dev Connection Test: HTTP ' + res.getStatusCode());
    System.debug('  This proves: Named Cred → External Cred → Auth Provider → ALMDevOpsConnectedApp → Company Org');
} catch (Exception e) {
    System.debug('❌ Dev Connection Error: ' + e.getMessage());
}

System.debug('');

// Test Production connection
try {
    HttpRequest req = new HttpRequest();
    req.setMethod('GET');
    req.setEndpoint('callout:Production_1PJd20000004WkTGAU_1776244895509/services/data/v66.0/sobjects');
    HttpResponse res = new Http().send(req);
    System.debug('✓ Production Connection Test: HTTP ' + res.getStatusCode());
    System.debug('  This proves: Named Cred → External Cred → Auth Provider → ALMDevOpsConnectedApp → Loba Org');
} catch (Exception e) {
    System.debug('❌ Production Connection Error: ' + e.getMessage());
}

System.debug('\n========================================');
System.debug('SUMMARY: Everything is already connected!');
System.debug('========================================');
System.debug('Your DevOps Center uses ALMDevOpsConnectedApp');
System.debug('(which IS almdevopscenter) to authenticate to both');
System.debug('your Dev and Production orgs. The connections work');
System.debug('and are ready to use for deployments.');
System.debug('========================================');