# GitHub Wiki behavior and URLs

## Authoritative references

- [Adding or editing wiki pages](https://docs.github.com/en/communities/documenting-your-project-with-wikis/adding-or-editing-wiki-pages): a wiki is a separate Git repository, filenames determine page titles, extensions determine rendering, and only the default branch is published. Browser Save Page creates a commit.
- [Creating a footer or sidebar](https://docs.github.com/en/communities/documenting-your-project-with-wikis/creating-a-footer-or-sidebar-for-your-wiki): `_Sidebar.md` and `_Footer.md` supply custom layout fragments.
- [Editing wiki content](https://docs.github.com/en/communities/documenting-your-project-with-wikis/editing-wiki-content): full wiki URLs work in Markdown links; MediaWiki table-of-contents syntax is unsupported. Use an explicit list of heading links.
- [Permanent links to files](https://docs.github.com/en/repositories/working-with-files/using-files/getting-permanent-links-to-files): use a commit SHA to link to an exact source version.

## URL construction and verification

For a repository `<owner>/<repo>`, the wiki Git remote is `https://github.com/<owner>/<repo>.wiki.git` and its reader URL is `https://github.com/<owner>/<repo>/wiki`. Do not include `.wiki`, `/blob/<branch>/`, or the Markdown extension in a reader page URL.

For ordinary filenames, remove only the final `.md` or `.markdown` extension, replace spaces with ASCII hyphens, preserve case and existing hyphens, then percent-encode the UTF-8 page slug as one URL path segment. This is a candidate calculation, not a complete specification of GitHub's title normalization. Do not apply heading-anchor rules (lowercasing and stripping punctuation) to page names. Encode characters such as `|`, `#`, `%`, and Unicode; do not use form-style `+` for spaces or double-encode a copied URL.

From inside the wiki clone (the helper reads its `origin` remote), or with `--repo`; the path is where the skill is installed:

```bash
node <skill-dir>/scripts/wiki-url.mjs 'GitHub-Wiki-Guide.md'
node <skill-dir>/scripts/wiki-url.mjs --repo <owner>/<repo> 'GitHub-Wiki-Guide.md'
```

For a published page, prefer its actual GitHub page-list link. With unusual punctuation, Unicode, repeated spaces, or trailing dots, inspect the wiki's page list using a browser or read-only HTML fetch, follow the link, and check that the intended page was loaded (a successful HTTP status alone may be insufficient). Preserve the returned path exactly. If verification is unavailable, label a calculated URL as unverified; do not silently invent normalization rules.

### Historical punctuation example

On 2026-10-04, the then-live wiki page list of a public repository contained the link:

```text
/<owner>/<repo>/wiki/My-Name-%E2%80%90-%7C.--%E2%80%90%E2%80%90..
```

The corresponding local filename was `My-Name-‐-|.--‐‐...md`. The link has two final dots while removing only `.md` from the filename leaves three. This observed discrepancy is why unusual published URLs must be read from GitHub rather than inferred. Do not generalize this observation into a rule that strips a dot from every filename.

Here `‐` is U+2010 (encoded `%E2%80%90`), distinct from ASCII `-`, and `|` is encoded `%7C`. Retain this as URL research, not as an active page link.

To encode an already verified, decoded slug:

```bash
node <skill-dir>/scripts/wiki-url.mjs --repo <owner>/<repo> --slug 'My-Name-‐-|.--‐‐..'
```

The helper is offline and never changes or publishes a wiki. Newly prepared pages may have an expected URL but are not live until published to the default branch.
