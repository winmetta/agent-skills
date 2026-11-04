# GitHub App setup

The review is posted by a GitHub App so it appears as `<app-name>[bot]`, separate from the developer who ran it. A GitHub App costs nothing, needs no extra user account or seat, and gives out tokens that expire after an hour. Set it up once per organization (or personal account); every developer who runs reviews needs the App ID and a private key.

Checked against GitHub's docs on 2026-10-31: [Registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app), [Authenticating as a GitHub App installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation), [Create a review for a pull request](https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request).

## 0. Does the App already exist?

App names are unique across all of GitHub, so "Name is already taken" when registering usually means your organization already has one, or you opened the wrong settings page. Check before registering a second App:

```bash
gh api /apps/<app-name> --jq '"\(.slug) id=\(.id) owner=\(.owner.login)"'
```

If it prints your organization as the owner, skip step 1 and note the App ID. Its settings page is `https://github.com/organizations/<org>/settings/apps/<app-name>` (or **Organization settings → Developer settings → GitHub Apps → Edit**). The breadcrumb must read the organization, not your personal **Settings → Developer settings**, which lists only Apps you own personally. Only organization owners and App managers can edit an App or its keys.

## 1. Register the App

An organization owner opens `https://github.com/organizations/<org>/settings/apps/new` (**Organization settings → Developer settings → GitHub Apps → New GitHub App**; for a personal account: **Settings → Developer settings → GitHub Apps**).

- **GitHub App name:** what the bot is called on PRs, e.g. `<org>-reviewer`; PRs show it as `<app-name>[bot]`.
- **Homepage URL:** the organization's site or repository.
- **Webhook:** untick **Active**. The App only acts when you run the script.
- **Repository permissions:** **Pull requests: Read and write** (Metadata: Read-only is added automatically). Nothing else; the scripts never read repository contents through the App.
- **Where can this GitHub App be installed?** Only on this account.

Click **Create GitHub App**. The App's page shows the **App ID** (a number, not the Client ID). Note it.

## 2. Install it

On the App's settings page open **Install App** (left sidebar) → choose the organization → **All repositories** or the ones to review. For an App that already exists, open the same page and check each repository you want reviewed is included. The installation ID is found automatically; set `LOCAL_PR_REVIEW_INSTALLATION_ID` only to skip that lookup.

## 3. Private key

Open the App's **Credentials** page, `https://github.com/organizations/<org>/settings/apps/<app-name>/key_pairs` (in older layouts, **Private keys** at the bottom of **General**), and click **Generate a private key**. A `.pem` file downloads. An App can have several keys, so generating one doesn't affect keys other developers use. Move it outside every repository and make it readable only by you:

```bash
mkdir -p ~/.config/local-pr-review
mv ~/Downloads/<app-name>.*.private-key.pem ~/.config/local-pr-review/app.pem
chmod 600 ~/.config/local-pr-review/app.pem
```

Anyone with this key can comment as the bot on every repository it is installed on. Never commit it or paste it into a chat. Another developer should generate their own key (and you revoke it on the same page when they leave), or you share one through a password manager.

## 4. Environment

Add to your shell profile (e.g. `~/.zshrc`), then load it with `source ~/.zshrc` or open a new terminal:

```bash
export LOCAL_PR_REVIEW_APP_ID=123456                         # the App ID
export LOCAL_PR_REVIEW_APP_KEY="$HOME/.config/local-pr-review/app.pem" # optional, this is the default
```

## 5. Check it

```bash
node <skill-dir>/scripts/app-token.mjs --repo <owner>/<repo>
```

Success prints `OK: can act as <app-name>[bot] on <owner>/<repo> (token expires …)`; it never prints the token. If it fails:

| Message                             | Cause and fix                                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LOCAL_PR_REVIEW_APP_ID is not set` | Step 4: set it and reload the shell.                                                                                                                      |
| `private key not found at …`        | The file is not at `~/.config/local-pr-review/app.pem`: move it there or set `LOCAL_PR_REVIEW_APP_KEY`.                                                   |
| `401`                               | The App ID is wrong (use the App ID, not the Client ID), or the key belongs to another App or was revoked.                                                |
| `404` on `/installation`            | The App is not installed on that repository: step 2.                                                                                                      |
| `403` or `Resource not accessible`  | The App lacks **Pull requests: Read and write**: change it on the App's **Permissions & events** page and accept the new permissions on the installation. |

## 6. Run a review

Run from the local clone of the repository the PR belongs to. Sign in to the engine you will use first, from your own terminal (these open a browser; an expired login makes the run fail with "Failed to authenticate"):

```bash
claude auth status   # or: claude auth login
codex login status   # or: codex login
```

`gh` must also be logged in (`gh auth status`); it reads the PR. Then do a dry run, which posts nothing and needs no App:

```bash
node <skill-dir>/scripts/run-review.mjs --pr <owner>/<repo>#<n> --engine claude
```

Use `--engine codex` for Codex and `--context ../<other-repo>` (repeatable) to let the reviewer read related local repositories. It checks the PR out in a sibling worktree `<repo>-pr-<n>`, prints the findings it would post and removes the worktree. When they look right, run the same command with `--post` to publish them as one review from the bot.

## Making the findings block merging

Inline review threads only block a merge when the branch requires conversation resolution: a branch ruleset's **Require conversation resolution before merging** (`required_review_thread_resolution: true` in the ruleset JSON), or the same option in classic branch protection. With it on, the PR cannot merge until the author (or a maintainer) resolves every bot thread.
