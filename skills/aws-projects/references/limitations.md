# Limitations of AWS project accounts

Read this before planning resources, IAM or CI/CD in a project account, or when an AWS call is denied. Facts are from the AWS Account Management Reference Guide, checked on 2026-11-16. Each section names its page (`…/reference/` is `https://docs.aws.amazon.com/accounts/latest/reference/`); reopen it before relying on a detail. Unless a line says otherwise, it applies until advanced features are activated.

## Contents

1. Structure and ownership
2. Region
3. Services by plan
4. IAM and access
5. Resource control policy
6. Spend limits
7. Team members
8. Closing and data deletion
9. After activating advanced features

## 1. Structure and ownership

Pages: `sign-up-for-aws.html`, `create-project.html`.

- A project is one AWS account (a project account) plus sharing settings. AWS suggests one project per application; one project can hold both development and production.
- All projects a user owns form an AWS Organization whose management account they can't use directly. AWS manages its SCPs, RCPs and human access roles, and turns on IAM Identity Center and IAM role manager.
- An AWS Builder ID owns the project accounts. There is no root user; a few root-only actions (deleting an S3 bucket policy or an SQS queue policy that denies everyone) are in the IAM console under Root access management, for the project owner only (`aws-actions-project-owners.html`).
- Resources in one project can't reach another project unless you set up cross-account access, which works only between projects of the same owner.
- Not available: AWS Marketplace, Savings Plans, HIPAA or SEC designation, opt-in Regions, IAM Access Analyzer, account aliases, alternate contacts, the console mobile app, account colours.

## 2. Region

Page: `project-regions.html`.

- AWS assigns one Region per user from the contact country: `us-east-2` (the Americas), `eu-north-1` (Europe, the Middle East and Africa) or `ap-southeast-2` (Asia-Pacific). Changing the contact address doesn't change it, and every project shares it. The page lists every country.
- In `us-east-1` only global and billing services are allowed (the managed SCP statement `UsEast1Partitional`): CloudFront, IAM, Route 53, ACM, STS, Bedrock model calls, KMS use (not `CreateKey`), listing S3 buckets (not creating them). AWS WAF and CloudWatch Logs are also allowed there, for global resources that need them. A similar statement (`UsWest2Partitional`) allows a few Bedrock calls in `us-west-2`.
- "Multi-Region or cross-Region features are not supported for any services" (supported-services page). The docs name Lambda@Edge and AWS WAF with CloudFront; the AWS starter rules add CloudFormation StackSets, cross-Region replication (DynamoDB, S3, RDS), multi-Region KMS keys and Route 53 latency, geolocation and failover routing.
- `eu-north-1` lacks some services (for example Rekognition, Textract, Personalize, App Runner, per the AWS starter rules).

## 3. Services by plan

Pages: `supported-services-sign-up-new.html`, `upgrade-account.html`, `scps-and-rcps-for-projects.html`.

- The Free and Paid plans each have an allowlist SCP (`AllowFreeTierServices`, `AllowPaidTierServices`) that the user can't edit. A service missing from the plan's list is denied. New AWS services may be missing until AWS adds them.
- Free plan: about $100 of sign-up credit plus up to $100 earned; you must upgrade after 6 months or when credits run out. CloudFront, Route 53 and KMS are on the Free allowlist.
- Paid plan: more services, but still denied: Spot Instances, Reserved Instances and capacity purchases, EC2 Fleet, Transit Gateway and Site-to-Site VPN, Cloud WAN, exportable ACM certificates, SES global deliverability and more. Security services such as GuardDuty, Security Hub, Macie and Detective are on the "not supported" list.
- Upgrading applies to all projects at once and can't be reversed.
- Quick check from the CLI: `aws freetier get-account-plan-state`, then compare the service with the plan's list.

## 4. IAM and access

Pages: `sign-up-for-aws.html`, `scps-and-rcps-for-projects.html`, `connect-ai-coding-tool.html`.

- Denied on both plans (`DenyIAMRestrictedActions`): `iam:*Provider*` (OIDC and SAML identity providers, so no GitHub Actions OIDC role), `iam:*LoginProfile*` (console passwords), IAM groups, account aliases, and server and signing certificate uploads. `sso:CreateInstance` is denied by the guardrail statement `BlockOrgEscape` (and `DenySSOCreateInstance` on the Paid plan).
- IAM users and roles can be created but are for programmatic access only. Access keys are allowed.
- Humans sign in with their Builder ID and get administrator access to each project they can reach. Don't create roles for team members; AWS manages human access.
- The CLI gets credentials with `aws login --profile <name>`, choosing the project's session in the browser. The docs give people administrator access to their projects, limited by the SCPs and RCPs; what the session role looks like is in section 4 of credentials.md. Profiles, SDK support and the session role are in [credentials.md](credentials.md).
- IAM role manager creates roles automatically; it can be turned off only after activating advanced features.

## 5. Resource control policy

Page: `scps-and-rcps-for-projects.html` (Resource control policies section).

- The RCP denies principals outside the user's organization (and AWS services acting for another account) on `s3`, `sts`, `kms`, `dynamodb`, `ecr`, `secretsmanager`, `sqs`, `logs`, `cognito-*`, `codebuild`, `autoscaling` and a few more. It can't be edited.
- Effects: a vendor or CI system in another AWS account can't assume a role in the project, and other accounts can't read your S3 buckets or KMS keys. Anonymous public access (a public S3 website) isn't affected, because that request has no principal ARN.

## 6. Spend limits

Pages: `create-spend-limit.html`, `update-spend-limit.html`.

- Paid plan only, per project, up to 10 projects. Minimum is the greater of $20 or AWS's estimate of the month's spend. Pre-tax, excluding credits. Only the owner can change it.
- Optional early controls: about 7 days before the limit an SCP stops new resource launches (auto scaling can fail); about 5 days before, idle EC2, RDS and SageMaker endpoints pause; about 4 days before, the top cost drivers (EC2, RDS, Lambda, Bedrock, SageMaker) pause.
- At the limit the whole project pauses. Data is kept, but **deleted after 90 days** with no action. Raising the limit reactivates it; some resources need restarting.
- Route 53 domain purchases: one per 24 hours, and they fail if the spend limit has no room.
- When the optional "stop new resource launches" control is on, its SCPs deny creation actions across many services, for example `cloudfront:CreateDistribution` and `route53:CreateHostedZone` (`DenyNetworking`) and `kms:CreateKey` (`DenySecurity`). A deny on a create action for a service the plan allows usually means one of these is applied, not an IAM problem; check spend status in AWS Settings → Billing.
- A third-party report says a Free plan account gets a small built-in budget that applies the same SCPs; this isn't in the AWS docs checked, so verify before relying on it.

## 7. Team members

Pages: `invite-team-members.html`, `monitor-your-project.html`.

- Invited by email from AWS Settings; they need their own Builder ID and have 14 days to accept.
- Every team member gets full admin access to each shared project; access can't be narrowed. They can't see billing, change spend limits, invite others or close the project.
- CloudTrail Event History shows who acted, in the `onBehalfOf` field; map it to a person with `aws identitystore describe-user` in `us-east-1`.

## 8. Closing and data deletion

Pages: `close-project.html`, `close-account-new-experience.html`.

- A closed project can be reopened for 90 days (contact AWS Support; outstanding balance paid within 60 days). After that its content is deleted, except CloudTrail trails.
- A project paused by a spend limit can't be closed until the limit is removed.
- Route 53 domains in a closed project are suspended and then deleted or released.

## 9. After activating advanced features

Page: `activate-advanced-features.html`.

- The user administers the Organization and can edit or remove most managed SCPs and RCPs, enable more Regions (edit the `RegionFloor` statement), use all services and turn off IAM role manager.
- Spend limits are removed (paused projects restart) and can't be created again; use AWS Budgets and Cost Anomaly Detection instead.
- A guardrail SCP (`BlockOrgEscape`, `ProtectManagedRoles`) stays attached to the root and applies to every account, including new ones.
- The docs say only that "certain" managed policies are removed at activation (the SCP that blocks account management APIs is), not the Free or Paid plan SCPs. If a plan deny such as `DenyIAMRestrictedActions` still applies after activation, find the attached SCPs from the management account (AWS Organizations console, or `aws organizations list-policies-for-target --target-id <account-id> --filter SERVICE_CONTROL_POLICY`). Editing or detaching one is the user's decision.
- Project accounts still have no root user email: they can't be removed from the Organization or join another, and their placeholder email can't be changed. To stop using one, close it. Accounts created after activation are normal member accounts.
- AWS creates an Identity Delegated Admin account for IAM Identity Center; its admin role is used in `us-east-1`.
- Project accounts never get `OrganizationAccountAccessRole`, and their AWS managed `AccountFullAccessRole` can't be assumed from the management account. See section 5 of [credentials.md](credentials.md).
- Custom roles reached from AWS Settings need a 12-hour session length.
- Remove AWS's starter rules file from the agent's instructions; it describes the limits that no longer apply.
