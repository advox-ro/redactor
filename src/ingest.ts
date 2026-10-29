// Every 15 minutes: read the feeds, store the new articles, embed them and place each one in a
// story. An article is stored once (its address is unique); one copied from another outlet's
// article is marked dup_of and doesn't count as a second source.
import { embed } from './ai';
import { countiesIn } from './counties';
import type { Env } from './env';
import { parseFeed } from './feeds';
import { FEEDS, type Feed } from './sources';
import { addToMean, dot, fromBlob, toBlob, type Vec } from './vec';

const HOUR = 3600_000;
// Set from 200 sampled cross-outlet pairs (2026-10-29): from 0.80 two articles are mostly about the
// same event, below it mostly not. Above JOIN an article joins the story;
// above COPY, from another outlet within 48 hours, it is the same text republished (independent
// reports of one event reach 0.97).
export const JOIN = 0.8;
export const COPY = 0.985;
const OPEN_FOR = 72 * HOUR;
const FROZEN_AT = 30; // a story's centroid stops moving after this many articles
const MAX_AGE = 4 * 24 * HOUR; // older items in a feed are not news any more

const UA = 'Mozilla/5.0 (compatible; redactor; +https://advox.ro)';

async function read(env: Env, feed: Feed, now: number): Promise<number> {
  let xml: string;
  try {
    const res = await fetch(feed.url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (e) {
    await env.DB.prepare(
      `INSERT INTO feeds (id, fail_count, last_error) VALUES (?, 1, ?)
       ON CONFLICT (id) DO UPDATE SET fail_count = fail_count + 1, last_error = excluded.last_error`,
    ).bind(feed.id, String(e).slice(0, 200)).run();
    return 0;
  }
  const items = parseFeed(xml).filter((i) => !i.published || now - i.published < MAX_AGE);
  const stmts = items.map((i) =>
    env.DB.prepare(
      `INSERT INTO articles (feed, outlet, url, title, lede, published_at, fetched_at, counties) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (url) DO NOTHING`,
    ).bind(
      feed.id,
      feed.outlet,
      i.url,
      i.title,
      i.summary.slice(0, 400),
      i.published,
      now,
      JSON.stringify([...new Set([...countiesIn(`${i.title} ${i.summary}`), ...(feed.county ? [feed.county] : [])])]),
    ),
  );
  const results = stmts.length ? await env.DB.batch(stmts) : [];
  await env.DB.prepare(
    `INSERT INTO feeds (id, last_ok_at, fail_count) VALUES (?, ?, 0)
     ON CONFLICT (id) DO UPDATE SET last_ok_at = excluded.last_ok_at, fail_count = 0, last_error = NULL`,
  ).bind(feed.id, now).run();
  return results.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
}

type Open = { id: number; centroid: Vec; n: number; outlets: Set<string>; counties: Record<string, number>; dirty: boolean };

/** Embeds the articles not embedded yet and places each in a story: the closest open story above
 *  JOIN, or a new one. */
async function place(env: Env, now: number): Promise<{ placed: number; stories: number }> {
  const fresh = (await env.DB.prepare('SELECT id, outlet, title, lede, counties FROM articles WHERE emb IS NULL ORDER BY id LIMIT 400').all<{ id: number; outlet: string; title: string; lede: string; counties: string }>()).results ?? [];
  if (!fresh.length) return { placed: 0, stories: 0 };
  const vecs = await embed(env.AI, fresh.map((a) => `${a.title}. ${a.lede}`));

  const open: Open[] = ((await env.DB.prepare('SELECT id, centroid, n_articles, outlets, counties FROM stories WHERE last_seen > ?').bind(now - OPEN_FOR).all<{ id: number; centroid: ArrayBuffer; n_articles: number; outlets: string; counties: string }>()).results ?? []).map((s) => ({
    id: s.id,
    centroid: fromBlob(s.centroid),
    n: s.n_articles,
    outlets: new Set(JSON.parse(s.outlets)),
    counties: JSON.parse(s.counties),
    dirty: false,
  }));
  // Recent articles from other outlets, to spot republished copy.
  const recent = ((await env.DB.prepare('SELECT id, outlet, emb FROM articles WHERE emb IS NOT NULL AND dup_of IS NULL AND fetched_at > ?').bind(now - 48 * HOUR).all<{ id: number; outlet: string; emb: ArrayBuffer }>()).results ?? []).map((r) => ({ id: r.id, outlet: r.outlet, v: fromBlob(r.emb) }));

  let created = 0;
  const writes: D1PreparedStatement[] = [];
  for (let i = 0; i < fresh.length; i++) {
    const a = fresh[i];
    const v = vecs[i];
    let copyOf: number | null = null;
    for (const r of recent) if (r.outlet !== a.outlet && dot(v, r.v) >= COPY) { copyOf = r.id; break; }
    recent.push({ id: a.id, outlet: a.outlet, v });

    let best: Open | null = null;
    let bestSim = JOIN;
    for (const s of open) {
      const sim = dot(v, s.centroid);
      if (sim >= bestSim) { best = s; bestSim = sim; }
    }
    if (!best) {
      const r = await env.DB.prepare('INSERT INTO stories (title, centroid, n_articles, outlets, counties, first_seen, last_seen) VALUES (?, ?, 0, ?, ?, ?, ?) RETURNING id')
        .bind(a.title, toBlob(v), '[]', '{}', now, now).first<{ id: number }>();
      best = { id: r!.id, centroid: v, n: 0, outlets: new Set(), counties: {}, dirty: true };
      open.push(best);
      created++;
    } else if (best.n < FROZEN_AT) {
      best.centroid = addToMean(best.centroid, best.n, v);
    }
    best.n++;
    if (!copyOf) best.outlets.add(a.outlet);
    for (const c of JSON.parse(a.counties) as string[]) best.counties[c] = (best.counties[c] ?? 0) + 1;
    best.dirty = true;
    writes.push(env.DB.prepare('UPDATE articles SET emb = ?, story_id = ?, dup_of = ? WHERE id = ?').bind(toBlob(v), best.id, copyOf, a.id));
  }
  for (const s of open.filter((s) => s.dirty))
    writes.push(
      env.DB.prepare('UPDATE stories SET centroid = ?, n_articles = ?, outlets = ?, counties = ?, last_seen = ? WHERE id = ?').bind(
        toBlob(s.centroid),
        s.n,
        JSON.stringify([...s.outlets]),
        JSON.stringify(s.counties),
        now,
        s.id,
      ),
    );
  for (let i = 0; i < writes.length; i += 100) await env.DB.batch(writes.slice(i, i + 100));
  return { placed: fresh.length, stories: created };
}

export async function ingest(env: Env, feeds: Feed[] = FEEDS) {
  const now = Date.now();
  const counts = await Promise.all(feeds.map((f) => read(env, f, now)));
  const stored = counts.reduce((a, b) => a + b, 0);
  const { placed, stories } = await place(env, now);
  return { feeds: feeds.length, stored, placed, newStories: stories };
}
