# Sources and refresh strategy

Checked on 2026-11-10. These links are discovery entry points, not pinned API contracts. Reopen the relevant source when using the skill; do not treat this date as evidence that the interface is still current.

- [Agent Toolkit for AWS user guide](https://docs.aws.amazon.com/agent-toolkit/latest/userguide/): find current setup, skills, CLI and runtime-discovery documentation.
- [Toolkit AWS CLI guide](https://docs.aws.amazon.com/agent-toolkit/latest/userguide/aws-cli.html): discover supported setup and skill-management capabilities. Cross-check the installed CLI's own help before using syntax from online docs.
- [AWS CLI reference](https://docs.aws.amazon.com/cli/latest/reference/): find the current command hierarchy and each operation's usage, options and documented scope.
- [Official toolkit repository](https://github.com/aws/agent-toolkit-for-aws): inspect skill instructions, bundled resources and upstream changes. Follow its current catalog layout rather than assuming a particular folder path.

Use official AWS documentation or AWS-owned source for technical claims. Record the CLI version and source checked when reporting compatibility; record a catalog version or commit when comparing skill content. Do not equate repository metadata versions with published catalog releases without verifying the relationship.

This skill deliberately bundles no installation script, management command recipes, minimum versions, agent paths or Region defaults. Rediscover those details through current documentation and local help so a CLI change does not silently turn an old recipe into the wrong action.
