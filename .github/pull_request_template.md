<!--
This repo squash-merges: the PR title becomes the commit subject and this description becomes the commit body.
Title format: Conventional Commits, e.g. `feat(skills): add review-migration`.
This repository is public: never include secrets, personal data or private links.
-->

## Summary

<!-- What does this PR do and why, in two or three sentences? -->

## What changed

-

## Testing

- [ ] `npm test` and `npm run check`
- [ ] Tried the skill in Claude Code and/or Codex (say which)
- [ ] For a release: `claude plugin validate .` passes and both `plugin.json` versions are bumped

## Checklist

- [ ] Title follows Conventional Commits and the description matches the final state of the PR
- [ ] Each skill's frontmatter is portable (`name` and `description` only) and `agents/openai.yaml` is in step with it
- [ ] README's skill list updated if a skill was added, renamed or removed
- [ ] No secrets, personal data or repo-specific details that belong in that repo instead
