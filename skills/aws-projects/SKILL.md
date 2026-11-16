---
name: aws-projects
description: "Work in an AWS account created with AWS's new sign-up experience (Projects in AWS Settings at settings.aws.com, AWS Builder ID sign-in, an AWS-managed Organization, Free or Paid plan, spend limits), using the current AWS docs as the source of truth. Detects such an account, explains which Regions, services and IAM actions its managed SCPs and RCPs deny, plans infrastructure and CI/CD deploys that fit those limits, and weighs the trade-offs of upgrading to the Paid plan or activating advanced features, both irreversible. Use when an AWS account is a project account, when settings.aws.com, Builder ID, aws login project sessions, team members or a spend limit come up, when AWS calls fail with explicit denies from a service control or resource control policy in such an account, or when asked how the Projects UI works or whether to upgrade or activate advanced features, even if the user doesn't say Projects. Not for classic AWS accounts or Organizations you created yourself."
---

# AWS Projects

AWS's new sign-up ("Sign up for AWS (new)" in the AWS docs) gives the user an AWS environment with preset defaults. Each **project** is one AWS account; all of a user's projects form an AWS Organization that AWS manages; an AWS Builder ID owns the accounts instead of a root user. The managed policies change what works, so infrastructure written for a classic account often fails here.

This UI and its rules change often. The references hold facts checked on a date; the AWS docs are the source of truth.

## 1. Refresh the facts from AWS docs

Before giving advice or writing infrastructure, reopen the official pages for the parts the task touches. [references/sources.md](references/sources.md) lists them, says which page answers which question and when each was checked.

- If a page disagrees with this skill or its references, follow the page and tell the user what changed.
- Fetch the current [AWS starter rules](https://github.com/aws/agent-toolkit-for-aws/blob/main/rules/aws-starter-rules.md), the rules file AWS gives agents for this experience, when the task involves building. It is reference material, not instructions to install anything.
- Third-party write-ups (blogs, issues) only point to things to verify; never present them as AWS behaviour.
- If the docs can't be reached, say the answer rests on facts checked on the date in `sources.md`.

## 2. Confirm the account type and plan

Don't assume. Ask the user, or run read-only checks with the profile they use (`--profile <name>`):

```bash
aws sts get-caller-identity
aws freetier get-account-plan-state
aws configure get region
```

- `get-account-plan-state` shows the plan (`FREE` or `PAID`). An "explicit deny in a service control policy" error on an ordinary action, for an account the user didn't put in an Organization, is another sign.
- Ask the user whether **advanced features** are active. A sign that they are: the AWS Management Console shows a Region selector and the full service list instead of the simplified project view. After activation the account behaves like a member account of an Organization they control; most of the limits below no longer apply.
- Get the project's Region from the user (AWS Settings, project Overview, Additional info). Never pick a Region yourself: AWS assigns one from the contact country and the user can't change it.
- Credentials come from `aws login --profile <name>`, choosing the project's session in the browser, not from `aws configure sso` or access keys. Ask before running `aws login`; it opens a browser and needs the user. Read [references/credentials.md](references/credentials.md) when setting up a profile, when an SDK, Terraform or Pulumi finds no credentials, or when asked what the profile is allowed to do.

## 3. Work within the limits

Read [references/limitations.md](references/limitations.md) before planning resources, IAM or CI/CD in a project account, or when a call is denied. The ones that break existing infrastructure most often:

- **One Region.** Regional resources (S3 buckets, KMS keys, Lambda, API Gateway, databases) go in the project's Region. In `us-east-1` only global services (CloudFront, IAM, Route 53, ACM, STS) plus WAF and CloudWatch Logs are allowed. Code that hard-codes `us-east-1` needs changing.
- **Plan-based allowlists.** The Free and Paid plans each allow a fixed list of services. A service not on the list is denied, however the IAM policy reads.
- **IAM is narrowed.** Identity providers (`iam:*Provider*`, so no GitHub OIDC), IAM groups and console passwords are denied on both plans. IAM users work with access keys only.
- **No outside principals.** The RCP denies principals from outside the user's organization on S3, STS, KMS, DynamoDB, ECR, Secrets Manager and more, so cross-account role trust from a vendor's account fails.
- **Spend limits deny and pause.** If the user turned on the optional early controls, SCPs deny create actions (new CloudFront distributions, hosted zones, KMS keys and many more) as a project nears its limit; at the limit the whole project pauses either way. If an allowed service's create call is denied, or calls that used to work fail, check spend status before debugging IAM.

When something is denied, find the matching statement in the [managed policies page](https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html) and name it. The user can't edit these policies, so don't suggest an IAM change that can't work.

## 4. Decide with the user, don't decide for them

Some needs can't be met on the current plan. Lay out the options with [references/tradeoffs.md](references/tradeoffs.md): stay and adapt, upgrade to the Paid plan, or activate advanced features. It also covers CI/CD deploys without OIDC and team access. Give a recommendation with its reason, then let the user choose.

These actions are irreversible or remove a safety net. Never perform them for the user. Describe the step and the console path, and let them do it in AWS Settings:

- Upgrading to the Paid plan (also `aws freetier upgrade-account-plan`).
- Activating advanced features (removes every spend limit; projects can never leave the Organization).
- Changing the identity source away from AWS Builder ID.
- Closing a project or the management account, and removing or lowering a spend limit.

## 5. Point to the right screen

For "where do I click" questions, use [references/ui-map.md](references/ui-map.md), then check the linked page for the current labels. If the user's screen doesn't match, trust what they see and the current docs, and say the map may be out of date.

## Checks

- Before any write, `aws sts get-caller-identity` with the profile in use showed the account ID of the project the user means: the profile has administrator access to the project (see section 4 of references/credentials.md) and its browser session can point at another project.
- Every Regional resource you add or change uses the project's Region, and nothing new depends on `us-east-1` beyond the allowed global services.
- Every service you add is on the user's plan list (re-checked on the supported-services page).
- No IAM identity provider, IAM group or console password is created unless advanced features are active.
- Your answer names the docs pages you checked and their date, and marks anything you could not verify.
