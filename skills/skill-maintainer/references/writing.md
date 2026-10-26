# Writing a good skill

Read this when drafting a new skill or reworking one. The format rules are in [formats.md](formats.md); this file is about what to put in the files.

## Contents

1. Principles
2. The description
3. The body
4. Bundled resources
5. Scope and safety
6. Review before you finish

## 1. Principles

- **Write for a capable agent.** The reader already knows how to code, use git and read docs. Every line costs context in every session that loads the skill, so keep only what changes its decisions: paths, commands, conventions, the order of steps that matters, and the pitfalls it would hit without being told.
- **Gotchas are the most valuable part.** A short list of non-obvious facts (a field that was renamed, a tool that silently drops a flag, a file that must not be formatted) often does more than pages of procedure.
- **Explain why.** A rule with its reason lets the agent handle cases the rule did not foresee. If you find yourself writing ALWAYS or NEVER in capitals, say what goes wrong instead. Keep absolute wording for real hazards: data loss, security, irreversible or outward-facing actions.
- **Match the freedom to how fragile the task is.**
  - Open-ended work (writing, design, review): describe the goal and how to judge it, and let the agent choose the approach.
  - A preferred but flexible shape: give an example or a template.
  - Fragile or must-be-identical operations: give exact commands or, better, a script.
- **One source of truth.** If the repo already documents a rule (`AGENTS.md`, `CONTRIBUTING.md`, a style guide), link to it. Do not copy it into the skill, where it will drift.
- **General, not overfitted.** A skill is used on many requests you have not seen. Do not turn one example, one past failure or one person's preference into a universal rule.

## 2. The description

Agents see only `name` and `description` when deciding which skill to load. The body is read only after that, so:

- **Say what it does, then when to use it**, in the words users actually type: "Create … Use when asked to …, or when …". Put every trigger here, not in the body.
- **Be specific to this skill's domain.** Name the file types, tools and nouns it handles, so it wins over a general-purpose skill and loses to an unrelated one.
- **Agents tend to under-use skills.** If the skill should load for requests that don't name it, say so ("…even if the user doesn't mention X").
- **Add a boundary only when it prevents a likely mix-up** with a neighbouring skill ("Not for …"). Avoid long capability lists and catch-alls that attract unrelated requests.
- **Simple one-step requests may not trigger any skill**, however well the description matches, because the agent can do them directly. Judge a description on substantive requests.

To test and tune a description, see "Trigger tests" in [testing.md](testing.md).

## 3. The body

- **Imperative steps**, in the order the agent should do them. Number them when the order matters.
- **Pick a shape that fits:** a workflow (sequential steps), a set of independent operations (one section each), or guidelines (standards to apply). Mixing is fine.
- **Show formats with an example** rather than describing them: a template for a report, an input and output pair for a commit message.
- **State the checks** the agent must run before it is done (a validator, tests, a build), and what to do when they fail.
- **Link each reference where it becomes relevant**, with a line saying when to read it: "read `references/api-errors.md` if the API returns an error" beats a list of links at the end.
- **Aim well under 500 lines.** The limit is not a target. Move detail that only some requests need into `references/` as soon as it makes the main path harder to follow.

## 4. Bundled resources

Add a resource only when you can name the request that needs it.

- **`scripts/`**: code the agent would otherwise rewrite each time, or that must behave identically every run. Scripts run without being loaded into context. Run every script you add, and give it a usage line and clear error messages, since the agent sees only its output. A sign you need one: in test runs, the agent wrote the same helper more than once.
- **`references/`**: lookup material needed only for some requests (schemas, API details, per-provider or per-framework guides, long examples). Keep them one level deep from `SKILL.md`. Give files over about 300 lines a contents list. For several variants (AWS, GCP, Azure), use one file per variant so the agent reads only the one it needs.
- **`assets/`**: files copied or adapted into the output (templates, images, fonts, starter projects). They are not instructions; the agent reads them only when it uses them.
- **Nothing else.** No README, changelog, installation guide or duplicate quick reference inside the skill. Evals go outside the skill folder (see [testing.md](testing.md)).

When updating a skill, check what uses a resource (the body, other references, scripts, other skills) before removing it.

## 5. Scope and safety

- **Lack of surprise.** What the skill does should match what its name and description suggest. Never write a skill that hides behaviour, exfiltrates data, weakens security or acts without the user's knowledge.
- **Preserve the user's intent.** The skill supports the task it is for; it does not swap the user's chosen tool, widen the task, or change unrelated configuration.
- **Permission does not grow.** Using a skill is not approval for extra outward-facing or destructive actions. Ask before pushing, publishing, sending, deleting or changing production systems, at the moment it happens. For steps that retry or change external state, say when to stop.
- **Secrets stay out.** Use environment variables or ignored local config; never put tokens or personal data in a skill, its examples or its evals.
- **Third-party skills run with the agent's permissions.** Read a skill before installing it.

## 6. Review before you finish

Read the draft once more as the agent that will receive it, with no memory of this conversation:

- Could it follow the steps without guessing a path, command or convention?
- Is there a line it would do fine without? Remove it.
- Is anything stated twice (body and reference, skill and repo docs)? Keep one.
- Does each rule say why, unless the reason is obvious?
- Would the description pick this skill for the requests it is for, and not for its neighbours?

Then run the checker and, for anything beyond a small edit, test it as in [testing.md](testing.md).
