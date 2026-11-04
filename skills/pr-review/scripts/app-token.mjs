#!/usr/bin/env node
// Checks the GitHub App setup: mints an installation token for one repository and reports the bot login
// and expiry. The token itself is never printed, so it can't leak into an agent transcript or a log.
// Usage: app-token.mjs --repo owner/name
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appInstallationAuth } from './github.mjs';

export const main = async (argv) => {
  const { values } = parseArgs({ args: argv, options: { repo: { type: 'string' } } });
  if (!values.repo || !/^[\w.-]+\/[\w.-]+$/.test(values.repo)) {
    console.error('Usage: app-token.mjs --repo owner/name');
    return 2;
  }
  try {
    const { login, expiresAt } = await appInstallationAuth(values.repo);
    console.log(`OK: can act as ${login} on ${values.repo} (token expires ${expiresAt}).`);
    return 0;
  } catch (err) {
    console.error(err.message);
    return 1;
  }
};

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) process.exit(await main(process.argv.slice(2)));
