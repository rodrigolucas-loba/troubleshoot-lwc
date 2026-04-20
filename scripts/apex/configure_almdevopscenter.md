# Connecting to almdevopscenter Connected App - Manual Steps

## Current Status ✓
Your DevOps Center is already working! Both environments are successfully connected:
- **Dev Environment** → Connected to "Company" org (Instance: SWE30S)
- **Production Environment** → Connected to "Loba" org (Instance: SWE106)

## What You Need to Do

Your Named Credentials are working, which means External Credentials are already configured. To connect them to the `almdevopscenter` Connected App, follow these steps:

### Step 1: Verify the almdevopscenter Connected App Exists

1. In your DevOps Center org, go to **Setup**
2. Search for **App Manager** in Quick Find
3. Look for the Connected App named **almdevopscenter**
4. If it doesn't exist, you need to create it first (see Step 2)
5. If it exists, click on it and verify it has these OAuth scopes:
   - Access and manage your data (api)
   - Perform requests on your behalf at any time (refresh_token, offline_access)
   - Full access (full)

### Step 2: Create almdevopscenter Connected App (if needed)

If the Connected App doesn't exist:

1. Go to **Setup** → **App Manager** → **New Connected App**
2. Fill in:
   - **Connected App Name**: almdevopscenter
   - **API Name**: almdevopscenter
   - **Contact Email**: your-email@example.com
3. Check **Enable OAuth Settings**
4. **Callback URL**: 
   ```
   https://login.salesforce.com/services/authcallback/00Dd200000Mp9RBEAZ/sf_devops__DevOps_Center
   ```
   (Replace `00Dd200000Mp9RBEAZ` with your DevOps Center org ID)
5. **Selected OAuth Scopes**: Add these:
   - Access and manage your data (api)
   - Perform requests on your behalf at any time (refresh_token, offline_access)  
   - Full access (full)
6. Click **Save**
7. Click **Continue**
8. Copy the **Consumer Key** and **Consumer Secret** - you'll need these

### Step 3: Update External Credentials to Use almdevopscenter

1. Go to **Setup** → **Named Credentials** → **External Credentials**
2. You should see two External Credentials:
   - `Dev_1PJd20000004WkTGAU_1776244935056`
   - `Production_1PJd20000004WkTGAU_1776244895509`
3. Click on **Dev_1PJd20000004WkTGAU_1776244935056**
4. Click **Edit**
5. Under **Authentication Protocol**, ensure **OAuth 2.0** is selected
6. Under **Authentication Flow Type**, select **Authorization Code**
7. For **Authentication Provider**, you may need to create a new Auth Provider that uses the almdevopscenter Connected App
8. Repeat for the Production External Credential

### Step 4: Create Auth Provider for almdevopscenter (if needed)

1. Go to **Setup** → **Auth. Providers** → **New**
2. **Provider Type**: Salesforce
3. **Name**: almdevopscenter_auth
4. **Consumer Key**: (paste the Consumer Key from Step 2)
5. **Consumer Secret**: (paste the Consumer Secret from Step 2)
6. **Authorize Endpoint URL**: `https://login.salesforce.com/services/oauth2/authorize`
7. **Token Endpoint URL**: `https://login.salesforce.com/services/oauth2/token`
8. Click **Save**

### Step 5: Re-authenticate External Credentials

For each External Credential:
1. Go to **Setup** → **Named Credentials** → **External Credentials**
2. Click on the External Credential
3. Under **Authentication Parameters**, click **New**
4. Select the Auth Provider you created
5. You'll be redirected to authenticate with the target org
6. Complete the OAuth flow
7. The authentication token will be stored

### Step 6: Verify Connections

Run this command to verify everything still works:
```bash
sf apex run --file scripts/apex/test_connections.apex
```

You should still see successful connections to both orgs.

## Alternative: Programmatic Approach

Since External Credentials and Auth Providers cannot be easily deployed via metadata, and your connections are already working, you have two options:

### Option A: Keep Current Setup
If your current External Credentials are already working (which they are!), you may not need to change anything unless:
- You specifically need to use a particular Connected App named "almdevopscenter"
- You're following organizational standards that require this specific Connected App
- There are security policies requiring this specific Connected App

### Option B: Check What's Currently Being Used
To see which Connected App is currently being used:
1. Go to **Setup** → **Named Credentials** → **External Credentials**
2. Open each External Credential
3. Look at the **Authentication Parameters** section
4. Check which Auth Provider is referenced
5. Go to **Setup** → **Auth. Providers** and find that provider
6. The provider will show which Consumer Key/Connected App it's using

## Current DevOps Center Configuration

**Project**: troubleshoot-lwc
**Pipeline**: troubleshoot-lwc Pipeline

**Environments**:
1. **Dev**
   - Named Credential: Dev_1PJd20000004WkTGAU_1776244935056
   - Org ID: 00DQJ00000G0QcP2AV
   - Status: ✓ WORKING - Connected to "Company"

2. **Production**
   - Named Credential: Production_1PJd20000004WkTGAU_1776244895509
   - Org ID: 00DWU00000l1sbB2AQ
   - Status: ✓ WORKING - Connected to "Loba"

## Questions to Consider

1. **Is almdevopscenter an existing Connected App?** If so, you need its Consumer Key and Secret.
2. **Are you required to use almdevopscenter?** Or is the current setup acceptable?
3. **Do you have admin access to the DevOps Center org?** You'll need it to modify External Credentials.
4. **What's the specific reason for using almdevopscenter?** Security policy? Organizational standard?

## Need Help?

If you can provide:
- Whether almdevopscenter already exists
- The Consumer Key and Secret (if available)
- Whether you need to create it or use an existing one

I can provide more specific guidance or scripts to automate parts of this process.