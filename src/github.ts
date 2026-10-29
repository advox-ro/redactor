// Reading the site repository through the GitHub API.
import type { Env } from './env';

const API = 'https://api.github.com';

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
