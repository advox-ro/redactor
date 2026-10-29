// Keeps the kb table in step with what has been published: the quizzes built into this Worker
// (content.ts), and from the site repository the question pool (web/src/data/quiz.json) and the
// wiki (wiki/*.md), and the rules for writing questions (questions/QUIZ.md and README.md).
// Each row carries a hash of what it was made from (a file's blob sha, or a question's JSON), so a
// run embeds only what changed and deletes what is gone. Runs on every push to either repository
// (POST /sync from their deploy jobs) and every night.
import { parse as parseYaml } from 'yaml';
import { embed } from './ai';
import type { Env } from './env';
import { QUIZZES } from './content';
import { blob, tree } from './github';
import { toBlob } from './vec';

type Item = { kind: 'quiz' | 'question' | 'wiki' | 'doc'; key: string; hash: string; load: () => Promise<{ title: string; body: string; meta: object } | null> };

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
  // Without a token for the site repository, only the quizzes are synced (the pool and wiki stay).
  const files = env.GITHUB_TOKEN ? await tree(env) : [];
  const out: Item[] = [];
  for (const f of files) {
    // The rules for writing questions, which the editor follows (EDITOR.md).
    if (f.path === 'questions/QUIZ.md' || f.path === 'questions/README.md')
      out.push({ kind: 'doc', key: f.path, hash: f.sha, load: async () => ({ title: f.path, body: await blob(env, f.sha), meta: {} }) });
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
          const sources = [...(body.split(/^## Surse\s*$/m)[1] ?? '').matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
          return { title: data.title, body: `${data.summary ?? ''}\n${short}`.replace(/\*\*/g, '').replace(/\[\d+\]/g, ''), meta: { updated: data.updated ?? null, sources } };
        },
      });
  }
  // The published quizzes are built into this Worker (content.ts).
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
  const synced = new Set(['quiz', ...(env.GITHUB_TOKEN ? ['question', 'wiki', 'doc'] : [])]);
  const gone = [...have.keys()].filter((k) => synced.has(k.split('/')[0]) && !keep.has(k));
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
