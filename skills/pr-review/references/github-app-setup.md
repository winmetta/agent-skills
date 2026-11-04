# GitHub App setup

The review is posted by a GitHub App so it appears as `<app-name>[bot]`, separate from the developer who ran it. A GitHub App costs nothing, needs no extra user account or seat, and gives out tokens that expire after an hour. Set it up once per organization (or personal account); every developer who runs reviews needs the App ID and a private key.

Checked against GitHub's docs on 2026-10-31: [Registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app), [Authenticating as a GitHub App installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation), [Create a review for a pull request](https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request).

## 1. Register the App

An organization owner opens **Organization settings → Developer settings → GitHub Apps → New GitHub App** (for a personal account: **Settings → Developer settings → GitHub Apps**).

- **GitHub App name:** what the bot is called on PRs, e.g. `<org>-reviewer`.
- **Homepage URL:** the organization's site or repository.
- **Webhook:** untick **Active**. The App only acts when you run the script.
- **Repository permissions:** **Pull requests: Read and write** (Metadata: Read-only is added automatically). Nothing else; the scripts never read repository contents through the App.
- **Where can this GitHub App be installed?** Only on this account.

Note the **App ID** shown after creating it.

## 2. Install it

On the App's page, **Install App** → choose the organization → **All repositories** or the ones to review. The installation ID is found automatically; set `PR_REVIEW_INSTALLATION_ID` only to skip that lookup.

## 3. Private key

On the App's page, **Generate a private key**. Store it outside every repository and make it readable only by you:

```bash
mkdir -p ~/.config/pr-review
mv ~/Downloads/<app-name>.*.private-key.pem ~/.config/pr-review/app.pem
chmod 600 ~/.config/pr-review/app.pem
```

Anyone with this key can comment as the bot on every repository it is installed on. Never commit it or paste it into a chat; share it with other reviewers through a password manager, or let each of them generate their own key (an App can have several) and revoke a key when someone leaves.

## 4. Environment

Add to your shell profile (e.g. `~/.zshrc`):

```bash
export PR_REVIEW_APP_ID=123456                         # the App ID
export PR_REVIEW_APP_KEY="$HOME/.config/pr-review/app.pem" # optional, this is the default
```

Then check it:

```bash
node <skill-dir>/scripts/app-token.mjs --repo <owner>/<repo>
```

It prints the bot login and the token's expiry, never the token.

## Making the findings block merging

Inline review threads only block a merge when the branch requires conversation resolution: a branch ruleset's **Require conversation resolution before merging** (`required_review_thread_resolution: true` in the ruleset JSON), or the same option in classic branch protection. With it on, the PR cannot merge until the author (or a maintainer) resolves every bot thread.
