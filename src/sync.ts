// Keeps the kb table in step with the site repository: the published quizzes (quizzes/*.md), the
// question pool (web/src/data/quiz.json) and the wiki (wiki/*.md). The repository is the source.
// Each row carries a hash of what it was made from (a file's blob sha, or a question's JSON), so a
// run embeds only what changed and deletes what is gone. Runs on every push to either repository
// (POST /sync from their deploy jobs) and every night.
import { parse as parseYaml } from 'yaml';
import { embed } from './ai';
import type { Env } from './env';
import { blob, tree } from './github';
import { toBlob } from './vec';

type Item = { kind: 'quiz' | 'question' | 'wiki'; key: string; hash: string; load: () => Promise<{ title: string; body: string; meta: object } | null> };

const front = (md: string) => {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  return m ? { data: parseYaml(m[1]) as Record<string, any>, body: m[2] } : { data: {}, body: md };
};

async function sha(text: string) {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** What the repository holds now, each item with its hash; contents load only when needed. */
async function items(env: Env): Promise<Item[]> {
  const files = await tree(env);
  const out: Item[] = [];
  for (const f of files) {
    const quiz = f.path.match(/^quizzes\/([a-z0-9-]+)\.md$/);
    if (quiz && quiz[1] !== 'readme')
      out.push({
        kind: 'quiz',
        key: quiz[1],
        hash: f.sha,
        load: async () => {
          const { data, body } = front(await blob(env, f.sha));
          const own = (data.questions ?? []).filter((q: unknown) => typeof q === 'object') as { text: string }[];
          return {
            title: data.title,
            body: [data.summary, ...own.map((q) => q.text), body.replace(/^- /gm, '')].join('\n'),
            meta: {
              date: data.date ?? null,
              tags: data.tags ?? [],
              counties: data.counties ?? null,
              questions: (data.questions ?? []).map((q: string | { id: string }) => (typeof q === 'string' ? q : `${quiz[1]}-${q.id}`)),
              news: (data.news ?? []).map((n: { url: string }) => n.url),
              stat: data.stat?.value ?? null,
            },
          };
        },
      });
    const wiki = f.path.match(/^wiki\/([a-z0-9-]+)\.md$/);
    if (wiki && wiki[1] !== 'readme')
      out.push({
        kind: 'wiki',
        key: wiki[1],
        hash: f.sha,
        load: async () => {
          const { data, body } = front(await blob(env, f.sha));
          // The page's summary and its "Pe scurt" bullets: what it is about, short enough to embed.
          const short = body.match(/## Pe scurt\n([\s\S]*?)\n## /)?.[1] ?? '';
          return { title: data.title, body: `${data.summary ?? ''}\n${short}`.replace(/\*\*/g, '').replace(/\[\d+\]/g, ''), meta: { updated: data.updated ?? null } };
        },
      });
  }
  // The question pool is one file; each question gets its own hash so only edited ones re-embed.
  const pool = files.find((f) => f.path === 'web/src/data/quiz.json');
  if (pool) {
    const questions = JSON.parse(await blob(env, pool.sha)).questions as Record<string, Record<string, any>>;
    for (const [id, q] of Object.entries(questions)) {
      const json = JSON.stringify(q);
      out.push({
        kind: 'question',
        key: id,
        hash: await sha(json),
        load: async () => ({
          title: q.text,
          body: [q.text, ...(q.choices ?? []).map((c: { label: string }) => c.label)].join('\n'),
          meta: { domain: q.domain, tier: q.tier, type: q.type, where: q.where ?? null, group: q.group ?? null, measures: q.measures },
        }),
      });
    }
  }
  return out;
}

export type SyncReport = { added: number; changed: number; deleted: number; unchanged: number };

export async function sync(env: Env): Promise<SyncReport> {
  const want = await items(env);
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
