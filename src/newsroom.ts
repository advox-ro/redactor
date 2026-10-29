// The daily run: from the day's picks to pull requests on the site repository. For each story:
// the fact sheet, a draft, the checks in code, the photo, the independent review, and one revision
// when something fails. A draft that still fails is kept in the drafts table with its report and
// never proposed. A person reads every pull request and decides; merging it publishes the quiz.
import { mechanical, review } from './checks';
import { draft, render, type Brief, type Draft, type Photo } from './draft';
import type { Env } from './env';
import { factSheet } from './facts';
import { openPullRequest } from './github';
import { download, findPhoto } from './photo';
import { pick } from './pick';
import { OverBudget } from './vox';

const MIN_CLAIMS = 3;

type Outcome = { storyId: number; slug?: string; status: 'pr_open' | 'failed' | 'skipped'; pr?: string; why?: string };

async function freeSlug(env: Env, slug: string): Promise<string> {
  for (let i = 1; ; i++) {
    const s = i === 1 ? slug : `${slug}-${i}`;
    const taken = await env.DB.prepare("SELECT 1 FROM kb WHERE kind = 'quiz' AND key = ? UNION SELECT 1 FROM drafts WHERE slug = ? AND status IN ('pr_open', 'merged')").bind(s, s).first();
    if (!taken) return s;
  }
}

function prBody(d: Draft, b: Brief, slug: string, photo: Photo | null, bias: string, notes: string[]): string {
  const used = new Set(d.facts.flatMap((f) => f.claims));
  const claims = b.claims.filter((c) => used.has(c.id));
  return [
    `Propunere de quiz făcută de Vox (inteligență artificială), din știrile din ${b.day}. Se publică doar dacă un om o aprobă (merge).`,
    `**Cine îl vede:** ${b.scope === 'national' ? 'toată lumea' : `doar cei din ${b.scope.join(', ')}`}.`,
    `**Unghiul:** ${b.angle}`,
    `### Faptele și citatele din care vin\n${d.facts.map((f) => `- ${f.text}\n${f.claims.map((id) => claims.find((c) => c.id === id)).filter((c) => !!c).map((c) => `  - ${c.outlet}: „${c.quote}” ([articol](${c.url}))`).join('\n')}`).join('\n')}`,
    photo ? `### Fotografia\n![${photo.alt}](${photo.src})\n${photo.credit}, ${photo.license}, [pagina de pe Commons](${photo.url})` : '',
    `### Verificarea independentă\n${bias}`,
    notes.length ? `### Note\n${notes.map((n) => `- ${n}`).join('\n')}` : '',
    `Fișierul: \`quizzes/${slug}.md\``,
  ].filter(Boolean).join('\n\n');
}

async function one(env: Env, b: Omit<Brief, 'claims'>): Promise<Outcome> {
  const claims = await factSheet(env, b.storyId);
  if (claims.length < MIN_CLAIMS || new Set(claims.map((c) => c.outlet)).size < 2) return { storyId: b.storyId, status: 'skipped', why: `${claims.length} verified claims` };
  const brief: Brief = { ...b, claims };
  let cost = 0;
  const notes: string[] = [];

  let { draft: d, cost: c1 } = await draft(env, brief);
  cost += c1;
  let problems = mechanical(d, brief);
  if (problems.length) {
    notes.push(`Prima variantă a avut ${problems.length} probleme de formă, corectate.`);
    ({ draft: d, cost: c1 } = await draft(env, brief, { issues: problems, previous: d }));
    cost += c1;
    problems = mechanical(d, brief);
  }
  const slug = await freeSlug(env, d.slug);
  const save = (status: string, md: string | null, report: object, pr?: string) =>
    env.DB.prepare('INSERT INTO drafts (story_id, slug, md, report, status, pr_url, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(b.storyId, slug, md, JSON.stringify(report), status, pr ?? null, cost, Date.now()).run();
  if (problems.length) {
    await save('failed', null, { problems, draft: d });
    return { storyId: b.storyId, slug, status: 'failed', why: problems.join('; ') };
  }

  const photo = await findPhoto(env, d.photo.queries, `${d.title}. ${d.summary}`);
  const local: Photo | null = photo ? { ...photo, src: `/quizzes/${slug}.jpg` } : null;
  let md = render(d, brief, local);
  let r = await review(env, md, brief);
  cost += r.cost;
  if (r.issues.length) {
    notes.push(`Verificarea a găsit ${r.issues.length} probleme, corectate într-o a doua variantă.`);
    ({ draft: d, cost: c1 } = await draft(env, brief, { issues: r.issues, previous: d }));
    cost += c1;
    const again = mechanical(d, brief);
    md = render(d, brief, local);
    if (again.length) {
      await save('failed', md, { problems: again, review: r.issues });
      return { storyId: b.storyId, slug, status: 'failed', why: again.join('; ') };
    }
    r = await review(env, md, brief);
    cost += r.cost;
    if (r.issues.length) {
      await save('failed', md, { review: r.issues, bias: r.bias });
      return { storyId: b.storyId, slug, status: 'failed', why: r.issues.join('; ') };
    }
  }
  if (!photo) {
    // The site needs a photo on a news quiz; without one the draft waits for a person to add it.
    notes.push('Nu am găsit o fotografie cu licență liberă potrivită: trebuie adăugată înainte de publicare.');
  }

  const files = [{ path: `quizzes/${slug}.md`, text: md }];
  if (photo) files.push({ path: `web/public/quizzes/${slug}.jpg`, base64: await download(photo.src) } as never);
  const pr = await openPullRequest(env, `quiz/${slug}`, files, `Quiz nou: ${d.title}`, prBody(d, brief, slug, local && { ...local, src: photo!.src }, r.bias, notes));
  await save('pr_open', md, { bias: r.bias, notes }, pr);
  return { storyId: b.storyId, slug, status: 'pr_open', pr };
}

/** The morning's choice of stories (pick.ts). With too few feeds working, the outlets that remain
 *  would skew the choice: no quiz that day. */
export async function choose(env: Env, day = new Date().toISOString().slice(0, 10)) {
  const healthy = await env.DB.prepare('SELECT COUNT(*) AS n FROM feeds WHERE last_ok_at > ?').bind(Date.now() - 6 * 3600_000).first<{ n: number }>();
  if ((healthy?.n ?? 0) < 10) return { day, picks: 0, stopped: `only ${healthy?.n ?? 0} feeds worked in the last 6 hours` };
  return { day, picks: (await pick(env, day)).length };
}

/** Drafts the next story picked today and not drafted yet: one per run, so a run stays well
 *  inside the time a scheduled Worker gets. Stops quietly when the day's budget is spent. */
export async function draftNext(env: Env, day = new Date().toISOString().slice(0, 10)): Promise<Outcome | null> {
  const p = await env.DB.prepare(
    `SELECT story_id, scope, angle FROM picks WHERE day = ? AND decision = 'keep' AND story_id NOT IN (SELECT story_id FROM drafts WHERE story_id IS NOT NULL) ORDER BY score DESC LIMIT 1`,
  ).bind(day).first<{ story_id: number; scope: string; angle: string }>();
  if (!p) return null;
  const scope = p.scope === 'national' ? ('national' as const) : (JSON.parse(p.scope) as string[]);
  try {
    const out = await one(env, { storyId: p.story_id, day, scope, angle: p.angle });
    // A skipped story is marked so the next run moves on to the next one.
    if (out.status === 'skipped')
      await env.DB.prepare('INSERT INTO drafts (story_id, slug, report, status, created_at) VALUES (?, ?, ?, ?, ?)').bind(p.story_id, '', JSON.stringify({ why: out.why }), 'skipped', Date.now()).run();
    return out;
  } catch (e) {
    if (e instanceof OverBudget) return { storyId: p.story_id, status: 'skipped', why: e.message };
    await env.DB.prepare('INSERT INTO drafts (story_id, slug, report, status, created_at) VALUES (?, ?, ?, ?, ?)').bind(p.story_id, '', JSON.stringify({ error: String(e).slice(0, 500) }), 'failed', Date.now()).run();
    return { storyId: p.story_id, status: 'failed', why: String(e).slice(0, 300) };
  }
}
