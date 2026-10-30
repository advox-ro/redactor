// What the editor reads each morning (GET /candidates): the last day's stories that could become a
// page, ranked by what code can measure, each with its articles. And where the editor records what
// it decided (POST /decisions), so a story is offered once. The judgement (what kind of story it is,
// how many people it touches, whether reader questions can be asked about it, whether advox.ro has
// asked about it already) is the editor's: it reads pages/ itself.
import { CODES } from './counties';
import type { Env } from './env';
import { BUCKET_OF, isLocalOutlet } from './sources';

const HOUR = 3600_000;
// A county counts for a story when at least this share of its articles name it.
const COUNTY_SHARE = 0.3;

export type Candidate = {
  story: number;
  title: string;
  score: number;
  kinds: number; // how many kinds of outlets carry it (sources.ts)
  outlets: string[];
  counties: string[];
  lastDay: number; // articles in the last 24 hours
  articles: { outlet: string; kind: string; title: string; lede: string; url: string; published: string | null }[];
};

export async function candidates(env: Env, limit = 40): Promise<Candidate[]> {
  const now = Date.now();
  const stories = (await env.DB.prepare(
    `SELECT s.id, s.title, s.outlets, s.counties, s.n_articles,
            (SELECT COUNT(*) FROM articles a WHERE a.story_id = s.id AND a.fetched_at > ?) AS recent
     FROM stories s
     WHERE s.last_seen > ? AND s.id NOT IN (SELECT story_id FROM decisions)`,
  ).bind(now - 24 * HOUR, now - 36 * HOUR).all<{ id: number; title: string; outlets: string; counties: string; n_articles: number; recent: number }>()).results ?? [];

  const ranked = stories.flatMap((s) => {
    const outlets: string[] = JSON.parse(s.outlets);
    // Two independent outlets, or a local outlet and one more article.
    if (outlets.length < 2 && !(outlets.some(isLocalOutlet) && s.n_articles >= 2)) return [];
    const kinds = new Set(outlets.map((o) => BUCKET_OF[o] ?? o)).size;
    const momentum = Math.min(1, Math.log1p(s.recent) / Math.log1p(20));
    // Only what code can measure about the story itself: how many kinds of outlets carry it, and
    // whether it is growing. Whether advox.ro has asked about it already is for the editor to judge.
    const score = 0.6 * Math.min(1, kinds / 3) + 0.4 * momentum;
    const counties = Object.entries(JSON.parse(s.counties) as Record<string, number>).filter(([code, k]) => CODES.has(code) && k / s.n_articles >= COUNTY_SHARE).map(([code]) => code);
    return [{ s, outlets, kinds, counties, score }];
  });
  ranked.sort((a, b) => b.score - a.score);

  const out: Candidate[] = [];
  for (const r of ranked.slice(0, limit)) {
    const arts = (await env.DB.prepare('SELECT outlet, title, lede, url, published_at FROM articles WHERE story_id = ? AND dup_of IS NULL ORDER BY published_at DESC LIMIT 8').bind(r.s.id).all<{ outlet: string; title: string; lede: string; url: string; published_at: number | null }>()).results ?? [];
    out.push({
      story: r.s.id,
      title: r.s.title,
      score: Math.round(r.score * 100) / 100,
      kinds: r.kinds,
      outlets: r.outlets,
      counties: r.counties,
      lastDay: r.s.recent,
      articles: arts.map((a) => ({ outlet: a.outlet, kind: BUCKET_OF[a.outlet] ?? 'other', title: a.title, lede: a.lede, url: a.url, published: a.published_at ? new Date(a.published_at).toISOString() : null })),
    });
  }
  return out;
}

export type Decision = { story: number; decision: 'keep' | 'drop'; reason: string; scope?: 'national' | string[]; slug?: string; pr?: string };

export async function decide(env: Env, list: Decision[]): Promise<{ recorded: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const ok = list.filter((d) => Number.isInteger(d.story) && (d.decision === 'keep' || d.decision === 'drop') && typeof d.reason === 'string' && d.reason.trim());
  if (!ok.length) return { recorded: 0 };
  await env.DB.batch(
    ok.map((d) =>
      env.DB.prepare('INSERT OR REPLACE INTO decisions (story_id, day, decision, scope, reason, slug, pr_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
        d.story,
        day,
        d.decision,
        d.scope ? (d.scope === 'national' ? 'national' : JSON.stringify(d.scope)) : null,
        d.reason.slice(0, 500),
        d.slug ?? null,
        d.pr ?? null,
        Date.now(),
      ),
    ),
  );
  return { recorded: ok.length };
}
