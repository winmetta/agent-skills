// GitHub REST helpers for the pr-review scripts: GitHub App authentication and paginated requests.
// Node 20+, no dependencies. Configuration comes from the environment, never from the repository:
//   PR_REVIEW_APP_ID           the GitHub App's numeric App ID (required to post)
//   PR_REVIEW_APP_KEY          path to the App's private key (.pem); default ~/.config/pr-review/app.pem
//   PR_REVIEW_INSTALLATION_ID  optional; found from the repository when unset
//   GITHUB_API_URL             optional; default https://api.github.com (GitHub Enterprise Server: https://<host>/api/v3)
import { sign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const apiUrl = (env = process.env) => (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');

export const loadConfig = (env = process.env) => ({
  appId: env.PR_REVIEW_APP_ID || '',
  keyPath: env.PR_REVIEW_APP_KEY || join(homedir(), '.config', 'pr-review', 'app.pem'),
  installationId: env.PR_REVIEW_INSTALLATION_ID || '',
});

export const hasAppConfig = (config) => Boolean(config.appId) && existsSync(config.keyPath);

const base64url = (value) => Buffer.from(value).toString('base64url');

// A GitHub App JWT: RS256, issued 60 s in the past against clock drift, valid for 9 minutes (the limit is 10).
export const makeAppJwt = ({ appId, privateKey, now = Math.floor(Date.now() / 1000) }) => {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }));
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
};

export const request = async (method, path, { token, body, base = apiUrl() } = {}) => {
  const res = await fetch(path.startsWith('http') ? path : `${base}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pr-review-skill',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = data?.errors ? ` ${JSON.stringify(data.errors)}` : '';
    const err = new Error(`${method} ${path} failed: ${res.status} ${data?.message ?? res.statusText}${detail}`);
    err.status = res.status;
    throw err;
  }
  return data;
};

// Follows page=N until a short page; GitHub caps PR files at 3000 (30 pages of 100).
export const paginate = async (path, opts, maxPages = 30) => {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const items = await request('GET', `${path}${sep}per_page=100&page=${page}`, opts);
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
};

// Returns { token, login } for the App's installation on owner/repo, scoped to that one repository.
// login is the bot's user login (<app-slug>[bot]), used to find the bot's earlier comments.
export const appInstallationAuth = async (repo, config = loadConfig()) => {
  if (!config.appId) throw new Error('PR_REVIEW_APP_ID is not set. See references/github-app-setup.md.');
  if (!existsSync(config.keyPath)) throw new Error(`GitHub App private key not found at ${config.keyPath} (set PR_REVIEW_APP_KEY).`);
  const jwt = makeAppJwt({ appId: config.appId, privateKey: readFileSync(config.keyPath, 'utf8') });
  const app = await request('GET', '/app', { token: jwt });
  const installationId = config.installationId || (await request('GET', `/repos/${repo}/installation`, { token: jwt })).id;
  const { token, expires_at: expiresAt } = await request('POST', `/app/installations/${installationId}/access_tokens`, {
    token: jwt,
    body: { repositories: [repo.split('/')[1]] },
  });
  return { token, login: `${app.slug}[bot]`, expiresAt };
};

// The developer's own gh CLI token, for read-only dry runs before the App exists.
export const ghCliToken = () => {
  const res = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : '';
};

// owner/repo#123, owner/repo/pull/123 or a full pull request URL.
export const parsePr = (value) => {
  const m = String(value ?? '').match(/([\w.-]+)\/([\w.-]+)(?:#|\/pulls?\/)(\d+)/);
  if (!m) throw new Error(`Cannot read a pull request from "${value}". Use owner/repo#123 or a PR URL.`);
  return { repo: `${m[1]}/${m[2]}`, number: Number(m[3]) };
};
