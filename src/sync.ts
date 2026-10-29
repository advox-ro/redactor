// Keeps the kb table in step with the content built into this Worker (content.ts): the published
// quizzes, the question pool and the wiki. Each row carries a hash of what it was made from, so a
// run embeds only what changed and deletes what is gone. Runs every 30 minutes, after the ingest.
import { embed } from './ai';
import type { Env } from './env';
import { POOL, QUIZZES, WIKI } from './content';
import { toBlob } from './vec';

type Item = { kind: 'quiz' | 'question' | 'wiki'; key: string; hash: string; load: () => Promise<{ title: string; body: string; meta: object } | null> };

async function sha(text: string) {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'" };
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#x27|#39);/g, (_, e) => ENTITIES[e]);

/** What has been published, each item with its hash; contents load only when needed. */
async function items(): Promise<Item[]> {
  const out: Item[] = [];
  for (const p of WIKI) {
    // The page's summary and its "Pe scurt" bullets: what it is about, short enough to embed.
    const short = text(p.html.match(/<h2 id="pe-scurt">[\s\S]*?<\/h2>([\s\S]*?)<h2/)?.[1] ?? '').trim();
    out.push({
      kind: 'wiki',
      key: p.slug,
      hash: await sha(JSON.stringify([p.data, short, p.sources.map((s) => s.n)])),
      load: async () => ({ title: p.data.title, body: `${p.data.summary}\n${short}`.replace(/\[\d+\]/g, ''), meta: { updated: p.data.updated, sources: p.sources.map((s) => s.n) } }),
    });
  }
  for (const q of QUIZZES) {
    const d = q.data as Record<string, any>;
    const json = JSON.stringify(q);
    const own = (d.questions ?? []).filter((x: unknown) => typeof x === 'object') as { text: string }[];
    out.push({
      kind: 'quiz',
      key: q.slug,
      hash: await sha(json),
      load: async () => ({
        title: d.title,
        body: [d.summary, ...own.map((x) => x.text), q.html.replace(/<[^>]+>/g, ' ')].join('\n'),
        meta: {
          date: d.date ?? null,
          tags: d.tags ?? [],
          counties: d.counties ?? null,
          questions: (d.questions ?? []).map((x: string | { id: string }) => (typeof x === 'string' ? x : `${q.slug}-${x.id}`)),
          news: (d.news ?? []).map((n: { url: string }) => n.url),
          stat: d.stat?.value ?? null,
        },
      }),
    });
  }
  // Each pool question gets its own hash, so only edited ones re-embed.
  for (const [id, q] of Object.entries(POOL.questions) as [string, Record<string, any>][]) {
    out.push({
      kind: 'question',
      key: id,
      hash: await sha(JSON.stringify(q)),
      load: async () => ({
        title: q.text,
        body: [q.text, ...(q.choices ?? []).map((c: { label: string }) => c.label)].join('\n'),
        meta: { domain: q.domain, tier: q.tier, type: q.type, where: q.where ?? null, group: q.group ?? null, measures: q.measures },
      }),
    });
  }
  return out;
}

export type SyncReport = { added: number; changed: number; deleted: number; unchanged: number };

export async function sync(env: Env): Promise<SyncReport> {
  const want = await items();
  const have = new Map(
    ((await env.DB.prepare('SELECT kind, key, hash FROM kb').all<{ kind: string; key: string; hash: string }>()).results ?? []).map((r) => [`${r.kind}/${r.key}`, r.hash]),
  );
  const todo = want.filter((i) => have.get(`${i.kind}/${i.key}`) !== i.hash);
  const report: SyncReport = { added: 0, changed: 0, deleted: 0, unchanged: want.length - todo.length };

  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const loaded = (await Promise.all(batch.map((it) => it.load()))).map((l, j) => ({ it: batch[j], l })).filter((x) => x.l?.title);
    const vecs = await embed(env.AI, loaded.map(({ l }) => `${l!.title}\n${l!.body}`));
    const now = Date.now();
    await env.DB.batch(
      loaded.map(({ it, l }, j) =>
        env.DB.prepare(
          `INSERT INTO kb (kind, key, title, body, meta, hash, emb, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (kind, key) DO UPDATE SET title = excluded.title, body = excluded.body, meta = excluded.meta, hash = excluded.hash, emb = excluded.emb, synced_at = excluded.synced_at`,
        ).bind(it.kind, it.key, l!.title, l!.body, JSON.stringify(l!.meta), it.hash, toBlob(vecs[j]), now),
      ),
    );
    for (const { it } of loaded) have.has(`${it.kind}/${it.key}`) ? report.changed++ : report.added++;
  }

  // Everything in the table comes from this Worker's build, so whatever it no longer holds is gone.
  const keep = new Set(want.map((i) => `${i.kind}/${i.key}`));
  const gone = [...have.keys()].filter((k) => !keep.has(k));
  for (let i = 0; i < gone.length; i += 50)
    await env.DB.batch(
      gone.slice(i, i + 50).map((k) => {
        const [kind, ...rest] = k.split('/');
        return env.DB.prepare('DELETE FROM kb WHERE kind = ? AND key = ?').bind(kind, rest.join('/'));
      }),
    );
  report.deleted = gone.length;

  // A quiz merged on the site marks the story it was proposed for.
  await env.DB.prepare(
    `UPDATE stories SET quiz_slug = (SELECT d.slug FROM decisions d WHERE d.story_id = stories.id AND d.slug IN (SELECT key FROM kb WHERE kind = 'quiz') LIMIT 1)
     WHERE quiz_slug IS NULL AND id IN (SELECT story_id FROM decisions WHERE slug IN (SELECT key FROM kb WHERE kind = 'quiz'))`,
  ).run();
  return report;
}
