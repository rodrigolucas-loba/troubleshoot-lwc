# Final Steps: Connect External Credentials to ALMDevOpsConnectedApp

## What I Found ✅

Your org already has:
1. **Connected App**: `ALMDevOpsConnectedApp` 
2. **Auth Providers**:
   - DevOps Center Prod (DEVOPS_CENTER_PROD) - Type: Salesforce
   - DevOps Center Test (DEVOPS_CENTER_TEST) - Type: Salesforce
3. **Working Named Credentials**:
   - Dev_1PJd20000004WkTGAU_1776244935056 → "Company" org
   - Production_1PJd20000004WkTGAU_1776244895509 → "Loba" org

## Question: Is ALMDevOpsConnectedApp the same as almdevopscenter?

Based on the naming convention, `ALMDevOpsConnectedApp` appears to be your DevOps Center Connected App. However, you mentioned "almdevopscenter" specifically. 

**Please clarify:**
- Is `ALMDevOpsConnectedApp` the Connected App you want to use?
- Or do you need to create a NEW Connected App specifically named `almdevopscenter`?

## If ALMDevOpsConnectedApp IS what you need:

### Step 1: Verify Auth Provider Configuration

The Auth Providers (DEVOPS_CENTER_PROD and DEVOPS_CENTER_TEST) show `Consumer Key: null`, which means they might not be fully configured yet, OR the Consumer Key is hidden from SOQL queries for security.

**To verify in the UI:**
1. Go to **Setup** → **Auth. Providers**
2. Click on **DevOps Center Prod**
3. Check if the Consumer Key field references `ALMDevOpsConnectedApp`
4. Repeat for **DevOps Center Test**

### Step 2: Check External Credential Configuration

1. Go to **Setup** → **Named Credentials** → **External Credentials**
2. Find these External Credentials:
   - `Dev_1PJd20000004WkTGAU_1776244935056`
   - `Production_1PJd20000004WkTGAU_1776244895509`
3. Open each one and verify:
   - **Authentication Protocol**: OAuth 2.0
   - **Authentication Flow Type**: Authorization Code  
   - **Authentication Provider**: Should reference either `DEVOPS_CENTER_PROD` or `DEVOPS_CENTER_TEST`

### Step 3: Verify Authentication Parameters

For each External Credential:
1. Scroll to **Authentication Parameters** section
2. You should see entries showing which user has authenticated
3. If parameters exist and connections work (which they do!), then you're already using the ALMDevOpsConnectedApp

## If you need to create "almdevopscenter" as a NEW Connected App:

### Step 1: Create the Connected App

1. Go to **Setup** → **App Manager** → **New Connected App**
2. Fill in:
   ```
   Connected App Name: almdevopscenter
   API Name: almdevopscenter
   Contact Email: your-email@example.com
   ```
3. Enable OAuth Settings:
   - **Callback URL**: 
     ```
     https://login.salesforce.com/services/authcallback/{YOUR_DEVOPS_ORG_ID}/sf_devops__DevOps_Center
     ```
   - **OAuth Scopes**:
     - Access and manage your data (api)
     - Perform requests on your behalf at any time (refresh_token, offline_access)
     - Full access (full)
4. Save and get the Consumer Key and Consumer Secret

### Step 2: Create New Auth Provider

1. Go to **Setup** → **Auth. Providers** → **New**
2. **Provider Type**: Salesforce
3. **Name**: almdevopscenter_prod
4. **URL Suffix**: almdevopscenter_prod
5. **Consumer Key**: (from Step 1)
6. **Consumer Secret**: (from Step 1)
7. **Authorize Endpoint**: `https://login.salesforce.com/services/oauth2/authorize`
8. **Token Endpoint**: `https://login.salesforce.com/services/oauth2/token`
9. Save

### Step 3: Update External Credentials

1. Go to **Setup** → **Named Credentials** → **External Credentials**
2. Edit `Dev_1PJd20000004WkTGAU_1776244935056`
3. Change **Authentication Provider** to `almdevopscenter_prod`
4. Remove old Authentication Parameters
5. Add new Authentication Parameter and authenticate
6. Repeat for Production External Credential

### Step 4: Test Connections

Run:
```bash
sf apex run --file scripts/apex/test_connections.apex
```

Both should still return Status 200.

## Current Status Summary

| Component | Name | Status |
|-----------|------|--------|
| Connected App | ALMDevOpsConnectedApp | ✅ EXISTS |
| Auth Provider (Prod) | DEVOPS_CENTER_PROD | ✅ EXISTS |
| Auth Provider (Test) | DEVOPS_CENTER_TEST | ✅ EXISTS |
| External Credential (Dev) | Dev_1PJd20000004WkTGAU_1776244935056 | ✅ WORKING |
| External Credential (Prod) | Production_1PJd20000004WkTGAU_1776244895509 | ✅ WORKING |
| Named Credential (Dev) | Dev_1PJd20000004WkTGAU_1776244935056 | ✅ CONNECTED |
| Named Credential (Prod) | Production_1PJd20000004WkTGAU_1776244895509 | ✅ CONNECTED |

## Next Action Required

**Please clarify:**
1. Is `ALMDevOpsConnectedApp` the Connected App you want to use?
2. Or do you specifically need a NEW Connected App named `almdevopscenter`?
3. Are your connections already using `ALMDevOpsConnectedApp` and everything is working as expected?

If everything is working and `ALMDevOpsConnectedApp` is the correct app, then **you're already done** - your DevOps Center project and pipeline are already connected to this Connected App via the External Credentials!