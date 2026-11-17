#!/usr/bin/env node
// Builds a GitHub Wiki page URL candidate from a Markdown filename, or encodes a
// verified decoded slug. Offline: never touches the network and never changes or
// publishes a wiki.
//
// Usage: node wiki-url.mjs [--repo <owner>/<repo>] [--slug] <filename-or-slug>
//   --repo  the wiki's repository; default: the `origin` remote of the current
//           directory (a <repo>.wiki.git clone or the main repository)
//   --slug  the value is a verified decoded page slug, not a filename
// Prints the URL on stdout. Exit codes: 0 ok, 2 bad input or an unreadable remote.
// Needs Node 20 or later and no packages.
// From the github-wiki skill: https://github.com/winmetta/agent-skills
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const REMOTE = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.wiki)?(?:\.git)?\/?$/;

/** Reader URL prefix for "owner/repo" (a trailing ".wiki" is accepted and dropped). */
export function wikiBase(repo) {
  const [owner, name, ...rest] = String(repo).split("/");
  const clean = name?.endsWith(".wiki") ? name.slice(0, -".wiki".length) : name;
  if (!owner || !clean || rest.length)
    throw new Error("--repo must look like owner/repo");
  return `https://github.com/${owner}/${clean}/wiki/`;
}

/** Turns a GitHub remote URL (https or ssh, wiki or main repository) into "owner/repo". */
export function repoFromRemote(url) {
  const match = REMOTE.exec(url.trim());
  if (!match) throw new Error(`Not a github.com remote: ${url.trim()}`);
  return `${match[1]}/${match[2]}`;
}

function originRepo() {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return repoFromRemote(url);
  } catch (error) {
    if (error.message.startsWith("Not a github.com")) throw error;
    throw new Error("Cannot read the origin remote; pass --repo owner/repo");
  }
}

// Percent-encodes like Python's quote(safe="-._~"): only A-Z a-z 0-9 - . _ ~ stay literal.
const encodeSegment = (value) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

export function pageUrl(value, { base, slug = false }) {
  if (!value || value.includes("/") || value.includes("\\")) {
    throw new Error("Supply one nonempty root-level filename or decoded slug");
  }
  let page = value;
  if (!slug) {
    const extension = [".markdown", ".md"].find((e) =>
      page.toLowerCase().endsWith(e),
    );
    if (!extension)
      throw new Error(
        "Filename must end in .md or .markdown; use --slug otherwise",
      );
    page = page.slice(0, -extension.length).replaceAll(" ", "-");
  }
  if (!page || page === "." || page === "..")
    throw new Error("Page slug cannot be empty or a dot path segment");
  return base + encodeSegment(page);
}

export function main(argv = process.argv.slice(2)) {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { repo: { type: "string" }, slug: { type: "boolean" } },
    });
    if (positionals.length !== 1)
      throw new Error("Supply exactly one filename or slug");
    console.log(
      pageUrl(positionals[0], {
        base: wikiBase(values.repo ?? originRepo()),
        slug: values.slug,
      }),
    );
    return 0;
  } catch (error) {
    console.error(`wiki-url: ${error.message}`);
    return 2;
  }
}

// Compare file paths, not URLs: import.meta.url percent-encodes spaces, process.argv[1] does not.
if (
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
) {
  process.exitCode = main();
}
