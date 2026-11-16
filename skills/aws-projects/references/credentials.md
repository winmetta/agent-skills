# Credentials and profiles

Read this when setting up or debugging CLI, SDK or infrastructure-as-code access to a project account, or before running anything that writes. Checked on 2026-11-16 against the pages named in each section; reopen them before relying on a detail.

## Contents

1. How `aws login` works
2. Profiles, sessions and the right project
3. Tools that can't read login credentials
4. What the session role can do
5. Reaching a project account from the management account

## 1. How `aws login` works

Pages: [Login for AWS local development](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html), [Connect an AI coding tool](https://docs.aws.amazon.com/accounts/latest/reference/connect-ai-coding-tool.html).

- Needs AWS CLI 2.32.0 or later (`aws --version`). Use it instead of `aws configure sso` or `aws sso login`; after activating advanced features, IAM Identity Center users still sign in with `aws login`.
- `aws login --profile <name>` opens a browser where the user picks a console session; `--remote` prints a URL and asks for a code instead, for a machine without a browser. It needs the user each time, so ask before running it.
- The short-term credentials last 15 minutes and refresh automatically, for up to 12 hours (the session role's maximum). The project docs add that AWS can renew them for 90 days before the browser approval is needed again.
- Credentials and the refresh token are cached in `~/.aws/login/cache` (or `AWS_LOGIN_CACHE_DIRECTORY`). Never read, print or copy that cache. `aws logout --profile <name>` deletes it.
- `aws login` writes `login_session = <ARN of the chosen session>` and `region` into the profile in `~/.aws/config`. For a project, set the region to the project's Region: the CLI suggests `us-east-1` by default, where Regional resources are denied.

## 2. Profiles, sessions and the right project

- Use one profile per project. The session picked in the browser decides which project the profile's credentials reach, so a profile can silently point at a different project after a later `aws login`. If the chosen session differs from the profile's saved `login_session`, the CLI asks before overwriting it.
- Before anything that writes (deploys, `pulumi up`, `terraform apply`, CLI calls that create, change or delete), run `aws sts get-caller-identity --profile <name>` and confirm the account ID matches the project the user means (AWS Settings → project → Overview → Additional info shows it). Stop and ask if it doesn't.

## 3. Tools that can't read login credentials

Page: [Login credentials provider](https://docs.aws.amazon.com/sdkref/latest/guide/feature-login-credentials.html), which has the support table for every SDK.

- Supported (2026-11-16): AWS CLI v2, SDKs for JavaScript 3.x, Java 2.x, Kotlin, .NET, PHP, Ruby, C++, Rust, Tools for PowerShell v5, and Python (Boto3 only with CRT: `pip install "boto3[crt]"`).
- Listed as not supported: SDK for Go V2, Java 1.x, JavaScript 2.x and Tools for PowerShell v4. Terraform's and Pulumi's AWS providers are built on the Go SDK, so check the provider's own docs, and use the workaround below if it finds no credentials.
- Workaround from the CLI docs: a second profile that asks the CLI for the credentials, which keeps refreshing them:

  ```ini
  [profile <name>-process]
  credential_process = aws configure export-credentials --profile <name> --format process
  region = <project-region>
  ```

  Point the tool at `<name>-process` (for example `AWS_PROFILE=<name>-process`). Don't export credentials into environment variables or files instead: they stop refreshing and can leak.

## 4. What the session role can do

Pages: [Creating OrganizationAccountAccessRole](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts_create-cross-account-role.html), `scps-and-rcps-for-projects.html`.

- Project accounts contain an AWS managed role, `AccountFullAccessRole`. In one checked project account, `aws login` sessions were for this role, under the `/managed/` path, with only `AdministratorAccess` attached; confirm with `aws sts get-caller-identity`.
- IAM allows everything, but the Organization's SCPs and RCPs still apply ([limitations.md](limitations.md)). An "explicit deny" error comes from them, not from a missing IAM permission, so adding IAM policies won't help.
- The `ProtectManagedRoles` SCP denies changing or deleting any role under `role/managed/`, and it stays after advanced features are activated. Don't try to edit or replace the session role.
- Treat the profile as a full administrator of the project: confirm the account (section 2) and get the user's go-ahead before writes.

## 5. Reaching a project account from the management account

Page: [Creating OrganizationAccountAccessRole](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts_create-cross-account-role.html).

- Project accounts never get `OrganizationAccountAccessRole`, even after activating advanced features. Only an AWS service can assume `AccountFullAccessRole`, so the management account can't switch into a project with it.
- To administer a project account from the management account, the user creates `OrganizationAccountAccessRole` in that project (IAM → Roles → Create role → Another AWS account: the management account ID, `AdministratorAccess`), then a policy allowing `sts:AssumeRole` on it in the management account, as the page describes.
- Create and test that role before editing the SCP that protects `AccountFullAccessRole`, or the account can lose all administrative access.
