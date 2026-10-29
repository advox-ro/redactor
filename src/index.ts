// redactor: reads the Romanian press, groups articles into stories, picks the stories worth a quiz
// and proposes each quiz to advox.ro as a pull request. Scheduled jobs (UTC, wrangler.jsonc):
//   every 30 minutes   ingest: read the feeds, place new articles in stories (ingest.ts)
//   02:00              sync the knowledge base with the site repository (sync.ts), clean up
//   03:30              choose the day's stories (pick.ts)
//   every 15 minutes, 04:00–08:59   draft the next chosen story (newsroom.ts)
// The same jobs can be started by hand, and the sync by the repositories' deploy jobs, with
// POST /sync or POST /run/<job> and the SYNC_TOKEN as a bearer token.
import type { Env } from './env';
import { ingest } from './ingest';
import { choose, draftNext } from './newsroom';
import { sync } from './sync';
import { spentToday } from './vox';

const DAY = 86_400_000;

async function cleanup(env: Env) {
  const now = Date.now();
  await env.DB.batch([
    // Embeddings are needed while a story is open; the text stays a month, for the record.
    env.DB.prepare('UPDATE articles SET emb = X\'\' WHERE fetched_at < ? AND length(emb) > 0').bind(now - 7 * DAY),
    env.DB.prepare('DELETE FROM claims WHERE article_id IN (SELECT id FROM articles WHERE fetched_at < ?) AND story_id NOT IN (SELECT story_id FROM drafts WHERE story_id IS NOT NULL)').bind(now - 30 * DAY),
    env.DB.prepare('DELETE FROM articles WHERE fetched_at < ? AND story_id NOT IN (SELECT story_id FROM drafts WHERE story_id IS NOT NULL)').bind(now - 30 * DAY),
    env.DB.prepare('DELETE FROM picks WHERE story_id NOT IN (SELECT DISTINCT story_id FROM articles WHERE story_id IS NOT NULL) AND story_id NOT IN (SELECT story_id FROM drafts WHERE story_id IS NOT NULL)'),
    env.DB.prepare('DELETE FROM stories WHERE last_seen < ? AND id NOT IN (SELECT DISTINCT story_id FROM articles WHERE story_id IS NOT NULL)').bind(now - 30 * DAY),
    env.DB.prepare('DELETE FROM runs WHERE started_at < ?').bind(now - 90 * DAY),
  ]);
}

const JOBS: Record<string, (env: Env) => Promise<unknown>> = {
  ingest,
  sync,
  choose: (env) => choose(env),
  draft: (env) => draftNext(env),
  cleanup,
};

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
  const [articles, stories, kb, failing, drafts, runs] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n, SUM(fetched_at > ?) AS today FROM articles').bind(now - DAY).first(),
    env.DB.prepare('SELECT COUNT(*) AS n, SUM(last_seen > ?) AS open FROM stories').bind(now - 3 * DAY).first(),
    env.DB.prepare('SELECT kind, COUNT(*) AS n FROM kb GROUP BY kind').all(),
    env.DB.prepare('SELECT id, fail_count, last_error FROM feeds WHERE fail_count > 0 ORDER BY fail_count DESC').all(),
    env.DB.prepare('SELECT slug, status, pr_url, cost_usd, created_at FROM drafts ORDER BY id DESC LIMIT 10').all(),
    env.DB.prepare("SELECT job, status, detail, started_at FROM runs WHERE job NOT LIKE 'vox:%' ORDER BY id DESC LIMIT 10").all(),
  ]);
  return { articles, stories, kb: kb.results, failingFeeds: failing.results, drafts: drafts.results, runs: runs.results, spentTodayUsd: await spentToday(env) };
}

export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const job = { '*/30 * * * *': 'ingest', '0 2 * * *': 'sync', '30 3 * * *': 'choose', '*/15 4-8 * * *': 'draft' }[event.cron];
    if (!job) return;
    ctx.waitUntil(job === 'sync' ? run(env, 'sync').then(() => run(env, 'cleanup')) : run(env, job));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const authorized = !!env.SYNC_TOKEN && request.headers.get('Authorization') === `Bearer ${env.SYNC_TOKEN}`;
    // Without the token there is nothing here: the same 404 for every address.
    if (!authorized) return new Response('not found\n', { status: 404 });
    try {
      if (url.pathname === '/status' && request.method === 'GET') return Response.json(await status(env));
      if (url.pathname === '/sync' && request.method === 'POST') return Response.json(await run(env, 'sync'));
      const job = url.pathname.match(/^\/run\/([a-z]+)$/)?.[1];
      if (job && JOBS[job] && request.method === 'POST') return Response.json(await run(env, job));
      return new Response('not found\n', { status: 404 });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
