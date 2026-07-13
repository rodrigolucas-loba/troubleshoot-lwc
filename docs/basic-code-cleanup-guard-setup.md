# Basic Code Cleanup Guard - Setup

1. Publish the automation repository with an immutable release tag such as `v1.0.0`.
2. Copy `docs/templates/basic-code-cleanup-guard-caller.yml` to `.github/workflows/` in the target repository.
3. Replace `<company-org>/<automation-repository>` and pin `uses` and `tools_ref` to the release tag or commit SHA.
4. Configure `SF_AUTH_URL` and, when LWC contract validation is enabled, `SF_VISUAL_AUTH_URL`.
5. Configure `TOOLS_REPOSITORY_TOKEN` only when the automation repository is private and the caller token cannot read it.
6. Require SonarCloud and the cleanup trust gate result before merging generated pull requests.

The generated pull request remains in draft. `SAFE_TO_REVIEW` means the automated checks passed; it does not replace human approval or external PR checks.
