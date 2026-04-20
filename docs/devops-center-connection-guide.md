# Connecting Existing DevOps Center Project to Connected App

## Overview
This guide explains how to connect your existing DevOps Center project and pipeline to a Connected App (in your case, `almdevopscenter`).

## Current Setup Analysis
Based on your project structure, you have:
- **DevOps Center Project**: "New Demo 2" 
- **Repository**: github.com/rodrigolucas-loba/new_demo_2
- **Existing Named Credentials**: 
  - `Production_1PJd20000004WkTGAU_1776244895509`
  - `Dev_1PJd20000004WkTGAU_1776244935056`
- **Pipeline Environments**: Production and Dev/Sync

## Connection Architecture

DevOps Center uses the following authentication flow:
1. **Connected App** (`almdevopscenter`) - OAuth authentication
2. **External Credential** - Stores OAuth tokens
3. **Named Credential** - References the External Credential and org URL
4. **Environment Record** - Links to the Named Credential

## Steps to Connect to almdevopscenter

### Step 1: Verify Connected App Setup

The `almdevopscenter` Connected App must be configured with:

```
OAuth Scopes Required:
- Access and manage your data (api)
- Perform requests on your behalf at any time (refresh_token, offline_access)
- Full access (full)

Callback URL:
- https://login.salesforce.com/services/authcallback/{org_id}/sf_devops__DevOps_Center
- https://{your-domain}.my.salesforce.com/services/authcallback/{org_id}/sf_devops__DevOps_Center
```

### Step 2: Create External Credential

External Credentials are automatically created by DevOps Center when you add an environment. However, you can verify/create them:

1. Navigate to: **Setup → Named Credentials → External Credentials**
2. Look for or create an External Credential with:
   - **Label**: Matches your environment (e.g., "Production_1PJd20000004WkTGAU_1776244895509")
   - **Authentication Protocol**: OAuth 2.0
   - **Connected App**: `almdevopscenter`

### Step 3: Add Authentication Parameters

For each External Credential:
1. Click **New** under Authentication Parameters
2. Select the **Connected App**: `almdevopscenter`
3. Authenticate with the target org
4. This stores the OAuth tokens

### Step 4: Verify/Create Named Credentials

Your existing Named Credentials should reference the External Credentials:

```xml
<NamedCredential xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Production_1PJd20000004WkTGAU_1776244895509</label>
    <namedCredentialType>SecuredEndpoint</namedCredentialType>
    <namedCredentialParameters>
        <parameterName>Url</parameterName>
        <parameterValue>https://your-org.salesforce.com</parameterValue>
    </namedCredentialParameters>
    <namedCredentialParameters>
        <externalCredential>Production_1PJd20000004WkTGAU_1776244895509</externalCredential>
        <parameterType>Authentication</parameterType>
    </namedCredentialParameters>
</NamedCredential>
```

### Step 5: Update DevOps Center Environments

Your sf_devops__Environment__c records should reference the Named Credentials:

```apex
// Example: Update environment to use new Named Credential
sf_devops__Environment__c env = [
    SELECT Id, sf_devops__Named_Credential__c
    FROM sf_devops__Environment__c
    WHERE sf_devops__Project__r.Name = 'New Demo'
    LIMIT 1
];
env.sf_devops__Named_Credential__c = 'Production_1PJd20000004WkTGAU_1776244895509';
update env;
```

## Verification Steps

### Test Named Credential Connection

Run this script to verify the connection:

```apex
// Test the Named Credential
HttpRequest req = new HttpRequest();
req.setMethod('GET');
req.setEndpoint('callout:Production_1PJd20000004WkTGAU_1776244895509/services/data/v66.0/query?q=SELECT+Id+FROM+Organization');

HttpResponse res = new Http().send(req);
System.debug('Status: ' + res.getStatusCode());
System.debug('Body: ' + res.getBody());
```

Expected result: Status code 200 with Organization data

### Check Environment Setup

```apex
// Verify environment configuration
List<sf_devops__Environment__c> envs = [
    SELECT Id, Name, 
           sf_devops__Named_Credential__c,
           sf_devops__Org_Id__c,
           sf_devops__Can_Track_Changes__c
    FROM sf_devops__Environment__c
    WHERE sf_devops__Project__r.Name = 'New Demo 2'
];

for (sf_devops__Environment__c env : envs) {
    System.debug('Environment: ' + env.Name);
    System.debug('Named Credential: ' + env.sf_devops__Named_Credential__c);
    System.debug('Org ID: ' + env.sf_devops__Org_Id__c);
    System.debug('Can Track Changes: ' + env.sf_devops__Can_Track_Changes__c);
}
```

## Common Issues and Solutions

### Issue 1: "Named Credential not found"
**Solution**: Ensure the Named Credential exists and is deployed to the DevOps Center org.

### Issue 2: "Authentication failed"
**Solution**: 
1. Re-authenticate the External Credential
2. Verify the Connected App has correct OAuth scopes
3. Check that the user has permission to access the target org

### Issue 3: "Invalid org connection"
**Solution**: 
1. Verify the org URL in the Named Credential parameter
2. Ensure the target org is active and accessible
3. Check that the OAuth tokens haven't expired

### Issue 4: Permission errors
**Solution**: Assign these permission sets:
- `sf_devops__DevOps_Center`
- `sf_devops__DevOps_CenterManager`
- `sf_devops_NamedCredentials`

## CLI Commands for Troubleshooting

### Check Current Default Org
```bash
sf org display
```

### Authenticate to Target Orgs
```bash
# Authenticate to the org you want to connect
sf org login web --alias myorg
```

### Query DevOps Center Metadata
```bash
# Query projects
sf data query --query "SELECT Id, Name FROM sf_devops__Project__c" --target-org your-devops-center-org

# Query environments
sf data query --query "SELECT Id, Name, sf_devops__Named_Credential__c FROM sf_devops__Environment__c" --target-org your-devops-center-org
```

## Next Steps

After successfully connecting:
1. Test a deployment from your pipeline
2. Verify change tracking works (for environments with tracking enabled)
3. Monitor the Activity History in DevOps Center
4. Set up CI/CD automation if needed

## Additional Resources

- [DevOps Center Documentation](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_dev2gp_devops_center.htm)
- [Named Credentials Guide](https://help.salesforce.com/s/articleView?id=sf.named_credentials_about.htm)
- [Connected Apps Guide](https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm)