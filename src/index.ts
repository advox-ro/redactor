// redactor: publishes advox.ro's content (the pages, the wiki and the question pool), reads the
// Romanian press and groups articles into stories, for the editor (EDITOR.md), which chooses the
// stories and proposes the pages. The editor reads the content from the repository itself.
// Scheduled jobs (UTC, wrangler.jsonc):
//   every 30 minutes   ingest: read the feeds, place new articles in stories (ingest.ts)
//   02:00              clean up
// Addresses, all with the REDACTOR_TOKEN as a bearer token:
//   GET  /candidates   the last day's stories that could become a page (candidates.ts)
//   POST /decisions    what the editor decided about them
//   GET  /status       counts, failing feeds, the last runs and decisions
//   POST /run/<job>    run ingest or cleanup by hand
//   /proposals         the editor's page pull requests, opened here as advox-ro (proposals.ts)
//   GET  /commons      photos from Wikimedia Commons, fetched for the editor (commons.ts)
// The site reads the published content through the Content entrypoint, over a service binding: a
// private connection between the two Workers, with no public address.
import { WorkerEntrypoint } from 'cloudflare:workers';
import { candidates, decide, type Decision } from './candidates';
import { photo, POOL, PAGES, WIKI, type Pool, type Page, type WikiPage } from './content';
import type { Env } from './env';
import { commonsFile, searchCommons } from './commons';
import { ingest } from './ingest';
import { closeProposal, openProposals, propose, proposal, ProposalError, type Proposal } from './proposals';

const DAY = 86_400_000;

async function cleanup(env: Env) {
  const now = Date.now();
  await env.DB.batch([
    // Embeddings are needed while a story is open; the text stays a month, for the record.
    env.DB.prepare("UPDATE articles SET emb = X'' WHERE fetched_at < ? AND length(emb) > 0").bind(now - 7 * DAY),
    env.DB.prepare('DELETE FROM articles WHERE fetched_at < ? AND story_id NOT IN (SELECT story_id FROM decisions)').bind(now - 30 * DAY),
    env.DB.prepare('DELETE FROM stories WHERE last_seen < ? AND id NOT IN (SELECT story_id FROM decisions) AND id NOT IN (SELECT DISTINCT story_id FROM articles WHERE story_id IS NOT NULL)').bind(now - 30 * DAY),
    env.DB.prepare('DELETE FROM runs WHERE started_at < ?').bind(now - 90 * DAY),
  ]);
}

const JOBS: Record<string, (env: Env) => Promise<unknown>> = { ingest, cleanup };

async function run(env: Env, job: string): Promise<unknown> {
  const started = Date.now();
  try {
    const result = await JOBS[job](env);
    await env.DB.prepare('INSERT INTO runs (job, started_at, finished_at, status, detail) VALUES (?, ?, ?, ?, ?)').bind(job, started, Date.now(), 'ok', JSON.stringify(result ?? null).slice(0, 2000)).run();
    return result;
  } catch (e) {
    await env.DB.prepare('INSERT INTO runs (job, started_at, finished_at, status, detail) VALUES (?, ?, ?, ?, ?)').bind(job, started, Date.now(), 'error', String(e).slice(0, 2000)).run();
    throw e;
  }
}

async function status(env: Env) {
  const now = Date.now();
  const [articles, stories, failing, decisions, runs] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n, SUM(fetched_at > ?) AS lastDay FROM articles').bind(now - DAY).first(),
    env.DB.prepare('SELECT COUNT(*) AS n, SUM(last_seen > ?) AS open FROM stories').bind(now - 3 * DAY).first(),
    env.DB.prepare('SELECT id, fail_count, last_error FROM feeds WHERE fail_count > 0 ORDER BY fail_count DESC').all(),
    env.DB.prepare('SELECT story_id, day, decision, reason, slug, pr_url FROM decisions ORDER BY created_at DESC LIMIT 20').all(),
    env.DB.prepare('SELECT job, status, detail, started_at FROM runs ORDER BY id DESC LIMIT 10').all(),
  ]);
  return { articles, stories, failingFeeds: failing.results, decisions: decisions.results, runs: runs.results };
}

export class Content extends WorkerEntrypoint<Env> {
  /** Every published page. */
  pages(): Page[] {
    return PAGES;
  }
  /** A page's photo, by its file name ("<slug>.jpg"), or null. */
  photo(file: string): Promise<Response | null> {
    return photo(this.env, file);
  }
  /** Every wiki page in its order, without its HTML. */
  wiki(): Pick<WikiPage, 'slug' | 'data'>[] {
    return WIKI.map(({ slug, data }) => ({ slug, data }));
  }
  /** A wiki page, or null. */
  wikiPage(slug: string): WikiPage | null {
    return WIKI.find((p) => p.slug === slug) ?? null;
  }
  /** The question pool (quiz.json). */
  pool(): Pool {
    return POOL;
  }
}

export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (event.cron === '*/30 * * * *') ctx.waitUntil(run(env, 'ingest'));
    if (event.cron === '0 2 * * *') ctx.waitUntil(run(env, 'cleanup'));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    // Without the token there is nothing here: the same 404 for every address.
    if (!env.REDACTOR_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.REDACTOR_TOKEN}`) return new Response('not found\n', { status: 404 });
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    try {
      if (route === 'GET /candidates') return Response.json(await candidates(env, Number(url.searchParams.get('limit')) || 40));
      if (route === 'POST /decisions') return Response.json(await decide(env, (await request.json()) as Decision[]));
      if (route === 'GET /status') return Response.json(await status(env));
      const job = url.pathname.match(/^\/run\/([a-z]+)$/)?.[1];
      if (request.method === 'POST' && job && JOBS[job]) return Response.json(await run(env, job));
      if (route === 'GET /commons') return Response.json(await searchCommons(url.searchParams.get('q') ?? ''));
      if (route === 'GET /commons/file') return await commonsFile(url.searchParams.get('url') ?? '');
      if (route === 'GET /proposals') return Response.json(await openProposals(env));
      if (route === 'POST /proposals') return Response.json(await propose(env, (await request.json()) as Proposal));
      const [, n, close] = url.pathname.match(/^\/proposals\/(\d+)(\/close)?$/) ?? [];
      if (n && !close && request.method === 'GET') return Response.json(await proposal(env, Number(n)));
      if (n && close && request.method === 'POST') return Response.json(await closeProposal(env, Number(n), ((await request.json()) as { reason: string }).reason));
      return new Response('not found\n', { status: 404 });
    } catch (e) {
      if (e instanceof ProposalError) return Response.json({ error: e.message }, { status: 400 });
      return Response.json({ error: String(e) }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
