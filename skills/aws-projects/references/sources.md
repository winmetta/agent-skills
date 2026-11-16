# Sources

Checked on 2026-11-16. These pages are the source of truth; the other references summarise them. Reopen the page for the question at hand before relying on a summary, and update the references and this date when a page has changed.

## AWS Account Management Reference Guide

Base URL: `https://docs.aws.amazon.com/accounts/latest/reference/`. The guide's contents list (`toc-contents.json` at the same base) shows every page under "Sign up for AWS (new)"; use it to find pages added since this check.

| Page                                                                                       | Answers                                                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `sign-up-for-aws.html`                                                                     | New versus advanced sign-up, feature comparison, what AWS manages                                 |
| `supported-services-sign-up-new.html`                                                      | Services on the Free plan, the Paid plan and not supported                                        |
| `scps-and-rcps-for-projects.html`                                                          | The exact managed SCPs and RCPs, including spend-limit SCPs; name the denying statement from here |
| `project-regions.html`                                                                     | Region per country, global services, finding the project's Region                                 |
| `connect-ai-coding-tool.html`                                                              | `aws login`, profiles per project, session length, agent setup                                    |
| `create-project.html`, `switch-projects.html`                                              | Projects and switching between them                                                               |
| `invite-team-members.html`, `remove-team-members.html`                                     | Team member permissions                                                                           |
| `upgrade-account.html`                                                                     | Free plan credits and limits, upgrading                                                           |
| `create-spend-limit.html`, `update-spend-limit.html`, `remove-spend-limit.html`            | Spend limits, early controls, pausing                                                             |
| `activate-advanced-features.html`                                                          | What activation changes, project accounts afterwards, preparation                                 |
| `remove-org-policies.html`, `manage-workforce-members.html`, `change-identity-source.html` | Administration after activation                                                                   |
| `aws-actions-project-owners.html`                                                          | Root-only actions for project owners                                                              |
| `monitor-your-project.html`                                                                | CloudTrail and `onBehalfOf`                                                                       |
| `close-project.html`, `close-account-new-experience.html`                                  | Closing and the 90-day post-closure period                                                        |

## Credentials

- [Login for AWS local development](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html): `aws login`, `login_session`, refresh, cache, `aws logout`, the `credential_process` workaround.
- [Login credentials provider](https://docs.aws.amazon.com/sdkref/latest/guide/feature-login-credentials.html): which SDKs and tools can read login credentials.
- [Creating OrganizationAccountAccessRole](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts_create-cross-account-role.html): `AccountFullAccessRole` in project accounts, and creating an admin role reachable from the management account.

## AWS Agent Toolkit

- [AWS starter rules](https://github.com/aws/agent-toolkit-for-aws/blob/main/rules/aws-starter-rules.md): the rules file AWS gives agents for this experience. Checked on 2026-11-16; AWS ships no skill for Projects in `aws/agent-toolkit-for-aws`.
- [Rules files](https://docs.aws.amazon.com/agent-toolkit/latest/userguide/rules-files.html): where agents keep rules files.

## Local CLI

- `aws freetier get-account-plan-state` reports the plan; `aws freetier upgrade-account-plan` upgrades it (irreversible: leave it to the user).
- `aws login help` for login options, such as `--remote` for a machine without a browser.
- Checked with AWS CLI 2.38.5. `aws login` needs 2.32.0 or later (CLI user guide).

## Third-party (unverified leads)

Use these only as hints of what to check in the AWS docs.

- [Wiz: Exploring the new AWS sign-up experience](https://www.wiz.io/blog/exploring-the-new-aws-sign-up-experience) on default security settings, such as account-level S3 Block Public Access being off and IAM role manager roles getting broad permissions.
- [nmfs-opensci/agent-skills#22](https://github.com/nmfs-opensci/agent-skills/issues/22) on payment methods per account.
