// The site repository through the GitHub API: reading its files, and proposing a quiz as a pull
// request. Commits are made as advox-ro (the token's account), with UTC dates.
import type { Env } from './env';

const API = 'https://api.github.com';
const AUTHOR = { name: 'advox-ro', email: '349334465+advox-ro@users.noreply.github.com' };

async function gh<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'redactor',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${init.method ?? 'GET'} ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

export type TreeEntry = { path: string; sha: string; type: string };

/** Every file on the branch, with its blob sha: the content's hash, so unchanged files are skipped. */
export async function tree(env: Env, ref = 'main'): Promise<TreeEntry[]> {
  const t = await gh<{ tree: TreeEntry[]; truncated: boolean }>(env, `/repos/${env.SITE_REPO}/git/trees/${ref}?recursive=1`);
  if (t.truncated) throw new Error('the repository tree is too large to read in one call');
  return t.tree.filter((e) => e.type === 'blob');
}

/** A file's text by its blob sha. */
export async function blob(env: Env, sha: string): Promise<string> {
  const b = await gh<{ content: string; encoding: string }>(env, `/repos/${env.SITE_REPO}/git/blobs/${sha}`);
  const bytes = Uint8Array.from(atob(b.content.replace(/\n/g, '')), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** A file's text by its path on main. */
export async function file(env: Env, path: string): Promise<string> {
  const entry = (await tree(env)).find((e) => e.path === path);
  if (!entry) throw new Error(`${path} is not in ${env.SITE_REPO}`);
  return blob(env, entry.sha);
}

export type NewFile = { path: string; text?: string; base64?: string };

/** Opens a pull request adding `files` on a new branch from main. Returns its address. */
export async function openPullRequest(env: Env, branch: string, files: NewFile[], title: string, body: string): Promise<string> {
  const repo = `/repos/${env.SITE_REPO}`;
  const head = await gh<{ object: { sha: string } }>(env, `${repo}/git/ref/heads/main`);
  const base = await gh<{ tree: { sha: string } }>(env, `${repo}/git/commits/${head.object.sha}`);
  const entries = [];
  for (const f of files) {
    const b = await gh<{ sha: string }>(env, `${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify(f.base64 ? { content: f.base64, encoding: 'base64' } : { content: f.text ?? '', encoding: 'utf-8' }),
    });
    entries.push({ path: f.path, mode: '100644', type: 'blob', sha: b.sha });
  }
  const t = await gh<{ sha: string }>(env, `${repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree: entries }) });
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const c = await gh<{ sha: string }>(env, `${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: title, tree: t.sha, parents: [head.object.sha], author: { ...AUTHOR, date }, committer: { ...AUTHOR, date } }),
  });
  await gh(env, `${repo}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: c.sha }) });
  const pr = await gh<{ html_url: string }>(env, `${repo}/pulls`, { method: 'POST', body: JSON.stringify({ title, body, head: branch, base: 'main' }) });
  return pr.html_url;
}
