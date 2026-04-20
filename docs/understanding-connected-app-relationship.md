# Understanding: Connected App vs DevOps Center Relationship

## Important Clarification

**Connected Apps DO NOT display pipelines or DevOps Center projects.**

A Connected App is purely an OAuth authentication mechanism. It's like a key that allows DevOps Center to unlock and access your target orgs.

## What Each Component Does

### Connected App (ALMDevOpsConnectedApp)
**Purpose**: Provides OAuth credentials for authentication
**What you see**:
- OAuth settings (Consumer Key, Consumer Secret)
- Callback URLs
- OAuth scopes (api, refresh_token, full)
- User permissions
- Connected App policies

**What you DON'T see**:
- ❌ DevOps Center projects
- ❌ Pipelines
- ❌ Environments
- ❌ Deployments
- ❌ Work items

### DevOps Center
**Purpose**: Manages projects, pipelines, and deployments
**What you see**:
- ✓ Projects (like "troubleshoot-lwc")
- ✓ Pipelines (like "troubleshoot-lwc Pipeline")
- ✓ Environments (Dev, Production)
- ✓ Work Items
- ✓ Deployment history
- ✓ Pipeline stages

## The Relationship

```
Connected App               DevOps Center
(Authentication)     →      (Application Logic)
     │                            │
     │                            ├─ Projects
     │                            ├─ Pipelines
     │                            ├─ Environments
     │                            └─ Deployments
     │                                  │
     └─────── Uses OAuth tokens ────────┘
              to authenticate to target orgs
```

## Where to See What

### To see your PIPELINES:
1. Open Salesforce
2. Go to **DevOps Center** (app launcher)
3. Click on **Pipelines** tab
4. You'll see: "troubleshoot-lwc Pipeline"

OR via Setup:
1. Setup → DevOps Center
2. Projects → troubleshoot-lwc
3. View the pipeline details

### To see your CONNECTED APP:
1. Setup → App Manager
2. Find: ALMDevOpsConnectedApp
3. Click to view OAuth settings
4. This shows authentication configuration ONLY

## What the Connected App DOES Show

When you open ALMDevOpsConnectedApp in App Manager, you'll see:

1. **API (Enable OAuth Settings)**:
   - Consumer Key
   - Consumer Secret
   - Callback URL
   - Selected OAuth Scopes

2. **Connected Apps OAuth Usage** (if you click Manage):
   - Which users have authorized this Connected App
   - OAuth policies
   - IP restrictions
   - Session policies

3. **Profiles/Permission Sets**:
   - Which users can use this Connected App

## What You're Looking For

Based on your question, you probably want to:

### Option 1: See Your Pipelines in DevOps Center
**Location**: DevOps Center App (not the Connected App)
```
Salesforce → App Launcher → DevOps Center → Pipelines
```
You'll see: troubleshoot-lwc Pipeline

### Option 2: Verify Connected App Is Being Used
**You've already done this!** The CLI verification proved that:
- Named Credentials → External Credentials → Auth Providers → **ALMDevOpsConnectedApp**
- Both Dev and Production environments successfully authenticate using ALMDevOpsConnectedApp

### Option 3: See Which Users Are Using the Connected App
**Location**: Connected App Management
```
Setup → App Manager → ALMDevOpsConnectedApp → Manage → 
Connected Apps OAuth Usage
```
This shows which users have authenticated using this Connected App.

## Common Misconception

❌ **INCORRECT**: "Pipelines should show up in the Connected App"
✓ **CORRECT**: "The Connected App enables pipelines to deploy to orgs"

Think of it like this:
- **Connected App** = Your car key (enables access)
- **DevOps Center** = Your car (the actual vehicle with controls)
- **Target Orgs** = Destinations (where you drive to)

You don't see your destination in the key - the key just unlocks the car that takes you there!

## Verification That Everything Works

I already verified through CLI that:

1. ✓ Your pipeline exists in DevOps Center
2. ✓ Your environments are configured
3. ✓ Your Named Credentials point to the correct target orgs
4. ✓ Your Named Credentials use ALMDevOpsConnectedApp for authentication
5. ✓ Both connections successfully authenticate (HTTP 200)

**This means ALMDevOpsConnectedApp IS being used by your pipelines!**

## Next Steps

If you want to:

### See Your Pipeline in Action:
1. Open **DevOps Center** app
2. Go to your project: troubleshoot-lwc
3. View the pipeline stages
4. Create a work item
5. Promote through the pipeline (Dev → Production)

### Verify OAuth Usage:
1. Setup → App Manager
2. ALMDevOpsConnectedApp → Manage
3. Connected Apps OAuth Usage
4. See which users have used this app to authenticate

### Deploy Using Your Pipeline:
1. DevOps Center → Projects → troubleshoot-lwc
2. Create a work item
3. Add changes
4. Deploy to Dev
5. Promote to Production

The ALMDevOpsConnectedApp will be used automatically in the background for all deployments!

## Summary

Your pipeline **already uses** ALMDevOpsConnectedApp - I proved this through CLI verification. The Connected App won't "display" the pipeline because that's not its function. The pipeline lives in DevOps Center, and the Connected App provides the OAuth keys that allow the pipeline to deploy to your orgs.

**Everything is already set up and working correctly!**