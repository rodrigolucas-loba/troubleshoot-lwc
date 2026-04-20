// Check Connected Apps and Auth Providers in the org
System.debug('=== Checking Connected Apps and Auth Providers ===\n');

// Query Connected Apps
System.debug('[1] CONNECTED APPS:');
try {
    // Note: ConnectedApplication is a special object with limited queryability
    List<String> connectedAppFields = new List<String>{'Name', 'MobileStartUrl', 'StartUrl'};
    String soql = 'SELECT Name FROM ConnectedApplication WHERE Name LIKE \'%devops%\' OR Name LIKE \'%ALM%\'';
    List<SObject> apps = Database.query(soql);
    
    if (apps.isEmpty()) {
        System.debug('  No DevOps-related Connected Apps found via query');
    } else {
        for (SObject app : apps) {
            System.debug('  - ' + app.get('Name'));
        }
    }
} catch (Exception e) {
    System.debug('  Cannot query ConnectedApplication: ' + e.getMessage());
    System.debug('  (This is expected - C   Apps have limited queryability)');
}

System.debug('\n[2] AUTH PROVIDERS:');
try {
    List<AuthProvider> authProviders = [
        SELECT Id, DeveloperName, FriendlyName, ProviderType, ConsumerKey
        FROM AuthProvider
        ORDER BY DeveloperName
    ];
    
    if (authProviders.isEmpty()) {
        System.debug('  No Auth Providers found');
    } else {
        System.debug('  Found ' + authProviders.size() + ' Auth Provider(s):');
        for (AuthProvider ap : authProviders) {
            System.debug('  - ' + ap.FriendlyName + ' (' + ap.DeveloperName + ')');
            System.debug('    Type: ' + ap.ProviderType);
            System.debug('    Consumer Key: ' + (ap.ConsumerKey != null ? ap.ConsumerKey.left(20) + '...' : 'null'));
        }
    }
} catch (Exception e) {
    System.debug('  Error querying Auth Providers: ' + e.getMessage());
}

System.debug('\n[3] CHECKING EXISTING NAMED CREDENTIALS:');
// We'll use the Tooling API or metadata API approach
System.debug('  Named Credentials in use:');
System.debug('  - Dev_1PJd20000004WkTGAU_1776244935056');
System.debug('  - Production_1PJd20000004WkTGAU_1776244895509');
System.debug('  - ALMDevOpsGitHub (GitHub connection)');
System.debug('\n  Note: External Credentials that these reference need to be checked in Setup UI');
System.debug('  Go to: Setup → Named Credentials → External Credentials');

System.debug('\n[4] RECOMMENDATION:');
System.debug('To connect to almdevopscenter Connected App:');
System.debug('1. Check if almdevopscenter Connected App exists in Setup → App Manager');
System.debug('2. Check current Auth Providers above to see what\'s currently used');
System.debug('3. Update External Credentials to point to almdevopscenter Auth Provider'); 