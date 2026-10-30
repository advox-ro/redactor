// The editor's pull requests, opened by the Worker as advox-ro. The editor runs where GitHub is
// reachable only for reading, so it sends its changes here and the Worker commits them to a branch
// and opens the pull request, with GITHUB_TOKEN (a token of the advox-ro account for this
// repository only). Two kinds, and nothing else, never on main:
//   page      branch page/<slug>: the page's own files (pages/<slug>.md, its photo and its quiz,
//             quizzes/<slug>.md)
//   content   branch content/<slug>: wiki pages (wiki/<name>.md) and question pool files
//             (questions/<name>.jsonl); the READMEs and QUIZ.md stay out of reach
// The checks on GitHub then merge it or say why not (.github/workflows/check.yml).
//   GET  /proposals              the editor's open pull requests
//   POST /proposals              { kind?, slug, title, body, message?, draft?, files: { path: base64 } }:
//                                commit the files to the branch (from main, or on top of it when it
//                                exists) and open its pull request if none is open; with draft, only
//                                commit them, to look at the page first (GET /preview/<slug>, preview.ts)
//   GET  /proposals/<n>          its state (open, merged, closed) and the checks' failure comments
//   POST /proposals/<n>/close    { reason }: comment the reason, close it, delete its branch
import type { Env } from './env';

const REPO = 'advox-ro/redactor';
const AUTHOR = { name: 'advox-ro', email: '349334465+advox-ro@users.noreply.github.com' };
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// The comment the check job posts when a check fails (check.yml).
const FAILED = 'Verificările nu au trecut';

export class ProposalError extends Error {}

async function gh<T>(env: Env, method: string, path: string, body?: unknown): Promise<T> {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set');
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'redactor',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GitHub ${method} ${path}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  return (r.status === 204 ? null : await r.json()) as T;
}

/** A file's bytes on a branch of the repository, or null when it isn't there. */
export async function fileAt(env: Env, path: string, ref: string): Promise<ArrayBuffer | null> {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set');
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.raw', 'User-Agent': 'redactor' },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub GET ${path}@${ref}: ${r.status}`);
  return r.arrayBuffer();
}

type Pull = { number: number; html_url: string; title: string; state: string; merged_at: string | null; head: { ref: string } };
const brief = (p: Pull) => ({ number: p.number, branch: p.head.ref, title: p.title, url: p.html_url });

export async function openProposals(env: Env) {
  const pulls = await gh<Pull[]>(env, 'GET', '/pulls?state=open&per_page=100');
  return pulls.filter((p) => OURS(p.head.ref)).map(brief);
}

export type Proposal = { kind?: 'page' | 'content'; slug: string; title: string; body: string; message?: string; draft?: boolean; files: Record<string, string> };

const KINDS = {
  page: {
    branch: (slug: string) => `page/${slug}`,
    allows: (path: string, slug: string) => [`pages/${slug}.md`, `pages/photos/${slug}.jpg`, `quizzes/${slug}.md`].includes(path),
    // The page's title; a "Pagină nouă:", "Quiz nou:" or "Quiz:" the editor already wrote isn't doubled.
    title: (t: string) => `Pagină nouă: ${t.replace(/^((pagină nouă|quiz( nou)?):\s*)+/i, '')}`,
  },
  content: {
    branch: (slug: string) => `content/${slug}`,
    allows: (path: string) => /^(wiki\/[a-z][a-z0-9-]*\.md|questions\/[a-z][a-z0-9-]*\.jsonl)$/.test(path),
    title: (t: string) => t,
  },
};
export const OURS = (ref: string) => ref.startsWith('page/') || ref.startsWith('content/');

export async function propose(env: Env, p: Proposal) {
  const kind = KINDS[p.kind ?? 'page'];
  if (!kind) throw new ProposalError('kind: page or content');
  if (!SLUG.test(p.slug ?? '')) throw new ProposalError('slug: lowercase letters, digits and hyphens');
  if (!p.title || !p.body) throw new ProposalError('title and body are required');
  const paths = Object.keys(p.files ?? {});
  if (!paths.length) throw new ProposalError('files: none given');
  const stray = paths.filter((f) => !kind.allows(f, p.slug));
  if (stray.length) throw new ProposalError(`files not allowed for a ${p.kind ?? 'page'} proposal: ${stray.join(', ')}`);

  const branch = kind.branch(p.slug);
  const existing = await gh<{ object: { sha: string } }>(env, 'GET', `/git/ref/heads/${branch}`).catch(() => null);
  const parent = existing?.object.sha ?? (await gh<{ object: { sha: string } }>(env, 'GET', '/git/ref/heads/main')).object.sha;
  const base = await gh<{ tree: { sha: string } }>(env, 'GET', `/git/commits/${parent}`);
  const tree = await Promise.all(
    paths.map(async (path) => {
      const blob = await gh<{ sha: string }>(env, 'POST', '/git/blobs', { content: p.files[path], encoding: 'base64' });
      return { path, mode: '100644', type: 'blob', sha: blob.sha };
    }),
  );
  const newTree = await gh<{ sha: string }>(env, 'POST', '/git/trees', { base_tree: base.tree.sha, tree });
  const date = new Date().toISOString(); // UTC
  const commit = await gh<{ sha: string }>(env, 'POST', '/git/commits', {
    message: p.message || kind.title(p.title),
    tree: newTree.sha,
    parents: [parent],
    author: { ...AUTHOR, date },
    committer: { ...AUTHOR, date },
  });
  if (existing) await gh(env, 'PATCH', `/git/refs/heads/${branch}`, { sha: commit.sha });
  else await gh(env, 'POST', '/git/refs', { ref: `refs/heads/${branch}`, sha: commit.sha });

  if (p.draft) return { branch, commit: commit.sha };
  const [open] = await gh<Pull[]>(env, 'GET', `/pulls?state=open&head=advox-ro:${branch}`);
  const pull = open ?? (await gh<Pull>(env, 'POST', '/pulls', { title: kind.title(p.title), head: branch, base: 'main', body: p.body }));
  return { ...brief(pull), commit: commit.sha };
}

async function pagePull(env: Env, n: number) {
  const pull = await gh<Pull>(env, 'GET', `/pulls/${n}`);
  if (!OURS(pull.head.ref)) throw new ProposalError(`#${n} is not one of the editor's pull requests`);
  return pull;
}

export async function proposal(env: Env, n: number) {
  const pull = await pagePull(env, n);
  const comments = await gh<{ body: string; created_at: string }[]>(env, 'GET', `/issues/${n}/comments?per_page=100`);
  return {
    ...brief(pull),
    state: pull.merged_at ? 'merged' : pull.state,
    failures: comments.filter((c) => c.body.startsWith(FAILED)).map((c) => ({ at: c.created_at, body: c.body })),
  };
}

export async function closeProposal(env: Env, n: number, reason: string) {
  if (!reason) throw new ProposalError('reason is required');
  const pull = await pagePull(env, n);
  if (pull.state !== 'open') throw new ProposalError(`#${n} is already ${pull.merged_at ? 'merged' : 'closed'}`);
  await gh(env, 'POST', `/issues/${n}/comments`, { body: reason });
  await gh(env, 'PATCH', `/pulls/${n}`, { state: 'closed' });
  await gh(env, 'DELETE', `/git/refs/heads/${pull.head.ref}`).catch(() => null);
  return { number: n, state: 'closed' };
}
