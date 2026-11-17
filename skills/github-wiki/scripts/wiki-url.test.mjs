// Run with: node --test skills/github-wiki/scripts/wiki-url.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { pageUrl, repoFromRemote, wikiBase } from "./wiki-url.mjs";

const base = wikiBase("octo/demo");

test("wikiBase builds the reader URL prefix", () => {
  assert.equal(base, "https://github.com/octo/demo/wiki/");
  assert.equal(wikiBase("octo/demo.wiki"), base);
  for (const bad of ["demo", "/demo", "octo/", "a/b/c"])
    assert.throws(() => wikiBase(bad), /owner\/repo/);
});

test("repoFromRemote accepts https and ssh, wiki and main remotes", () => {
  for (const url of [
    "https://github.com/octo/demo.wiki.git",
    "git@github.com:octo/demo.wiki.git",
    "https://github.com/octo/demo.git\n",
    "https://github.com/octo/demo",
  ])
    assert.equal(repoFromRemote(url), "octo/demo");
  assert.equal(
    repoFromRemote("https://github.com/octo/.github.wiki.git"),
    "octo/.github",
  );
  assert.throws(
    () => repoFromRemote("https://example.com/octo/demo.git"),
    /Not a github\.com remote/,
  );
});

test("pageUrl turns a filename into a page URL", () => {
  assert.equal(pageUrl("Home.md", { base }), `${base}Home`);
  assert.equal(pageUrl("My Page.markdown", { base }), `${base}My-Page`);
});

test("pageUrl percent-encodes the slug as one path segment", () => {
  assert.equal(pageUrl("A|B#C.md", { base }), `${base}A%7CB%23C`);
  assert.equal(pageUrl("Café.md", { base }), `${base}Caf%C3%A9`);
  assert.equal(pageUrl("It's (v1)*.md", { base }), `${base}It%27s-%28v1%29%2A`);
  assert.equal(
    pageUrl("a‐b|.x..", { base, slug: true }),
    `${base}a%E2%80%90b%7C.x..`,
  );
});

test("pageUrl rejects bad input", () => {
  for (const [value, slug] of [
    ["", false],
    ["a/b.md", false],
    ["a.txt", false],
    [".md", false],
    ["..", true],
  ]) {
    assert.throws(() => pageUrl(value, { base, slug }));
  }
});
