# Trade-offs and decisions

Read this when a need can't be met on the account's current plan, when planning CI/CD deploys, or when the user asks whether to upgrade or activate advanced features. Facts come from [limitations.md](limitations.md); re-check them on the pages in [sources.md](sources.md). Give a recommendation with its reason, but the choice and the click are the user's: both upgrades are irreversible.

## Contents

1. The three levels
2. Choosing a level
3. CI/CD deploys
4. Spend limit or AWS Budgets
5. Team access
6. Before activating advanced features

## 1. The three levels

|                                     | Free plan                                           | Paid plan                                       | Advanced features                                                |
| ----------------------------------- | --------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| Services                            | Short allowlist                                     | Longer allowlist                                | All services                                                     |
| Regions                             | Project Region, plus global services in `us-east-1` | Same                                            | Any Region the user enables                                      |
| Guardrails (SCPs, RCPs)             | AWS-managed, fixed                                  | AWS-managed, fixed                              | User-managed, except the guardrail SCP that stays                |
| IAM identity providers (OIDC, SAML) | Denied                                              | Denied                                          | Allowed                                                          |
| Cost safety                         | Credits, no charges                                 | Per-project spend limit that pauses the project | AWS Budgets and anomaly detection, no automatic pause            |
| Team access                         | Full admin per shared project                       | Same                                            | Fine-grained, with Account Access Manager or IAM Identity Center |
| Who runs governance                 | AWS                                                 | AWS                                             | The user                                                         |
| Reversible                          | —                                                   | No                                              | No                                                               |

## 2. Choosing a level

- **Stay and adapt** when the workload fits the allowlist and Region. Cheapest to run and nothing to administer. Adapt the infrastructure: move Regional resources to the project Region and drop features the plan denies.
- **Upgrade to Paid** when the workload needs a service that is only on the Paid list, or when Free Tier time or credits run out. Keeps AWS's guardrails and adds spend limits. Costs: real charges, and no way back to Free. It doesn't unlock OIDC providers, other Regions or the unsupported services.
- **Activate advanced features** when the need is one the managed policies block on every plan: an OIDC or SAML provider (keyless CI/CD), a second Region, an unsupported service (GuardDuty, Security Hub, Marketplace, Transit Gateway and so on), editing SCPs or RCPs, fine-grained team permissions, or HIPAA or SEC designation. Costs: the user now runs the Organization's security and governance; spend limits disappear for good; project accounts can never leave the Organization; the agent's starter rules no longer apply. It requires the Paid plan first.
- **Sign up for AWS (advanced) instead**, in a separate account, when the user needs a Region of their choice from the start, regulated workloads, or accounts whose root email they control. Moving resources between accounts is work, so weigh it against activating.

When unsure, prefer the smallest step that meets the need, because nothing here can be undone.

## 3. CI/CD deploys

GitHub Actions and similar systems normally assume a role through an OIDC identity provider. That provider can't be created until advanced features are active (`iam:*Provider*` is denied). Options:

| Option                                                            | Works on   | Trade-off                                                                                                                          |
| ----------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Deploy from a developer machine with `aws login --profile <name>` | Free, Paid | No stored secrets, short-lived credentials. Deploys depend on a person and their browser session (12 hours, renewing for 90 days). |
| IAM user with an access key stored as a CI secret                 | Free, Paid | Automated, but a long-lived key: scope it to deploy actions only, rotate it, and never print it. Weakest option.                   |
| Activate advanced features, then an OIDC provider and role        | Advanced   | Keyless and automated. Brings every cost of activation.                                                                            |
| A role in another AWS account                                     | —          | Blocked: the RCP denies principals outside the organization on `sts:*`.                                                            |

Recommend `aws login` for low-frequency deploys (personal sites, prototypes), and activation when automated keyless deploys matter more than the spend-limit safety net. Mention the access-key option only with its risks, and let the user choose it.

## 4. Spend limit or AWS Budgets

- A spend limit stops spending by pausing the project, which also takes the workload offline, and the data is deleted if the project stays paused for 90 days. Good for learning, prototypes and sandboxes; risky for anything users depend on unless a brief outage is acceptable.
- For a production workload on the Paid plan, set the limit well above normal spend, turn on only the gentle early controls (stop new launches, pause idle), and watch the 50%, 75% and 90% notifications.
- After activation only Budgets alerts remain: they notify but never stop spend. Suggest a budget with an alert as soon as the user activates.

## 5. Team access

- Before activation every team member is a full admin of each project shared with them. Share a project only with people trusted with everything in it, and use separate projects to separate access.
- Removing a team member doesn't delete what they created; CloudTrail `onBehalfOf` shows who did what.
- Fine-grained access needs advanced features. Changing the identity source away from Builder ID is a second irreversible step; only suggest it when the user has an identity provider to move to.

## 6. Before activating advanced features

Checklist for the user (from `activate-advanced-features.html`):

1. Tell team members; their console view changes.
2. Review each project's spend and stop idle or fluctuating resources, because spend limits go away.
3. Decide on a management account root email they control, then set its root password and MFA right after activation.
4. Plan Regions and edit the `RegionFloor` SCP statement before creating resources elsewhere.
5. Remove AWS's starter rules file from the agent's instructions; from then on, section 9 of [limitations.md](limitations.md) describes the account.
6. Add an AWS Budget with alerts.
7. If the management account needs to reach project accounts, check whether each has `OrganizationAccountAccessRole` and create it where missing.
