// Checks the pages against the rules in pages/README.md: the schema, the question pool, the wiki,
// the news pages' press links, photos and own questions, and duplicates (a question in two pages,
// two pages on the same thing). The question pool and the wiki are read from questions/ and wiki/.
// Every page is read through src/pagefile.ts, as the build reads it. Usage: npm run validate (tsx)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPool } from '../scripts/pool.mjs';
import { parsePage, published } from '../src/pagefile.ts';
import { parseQuiz } from '../src/quizfile.ts';

const root = dirname(fileURLToPath(import.meta.url));
const redactor = join(root, '..');

const MEASURES = ['experience', 'satisfaction', 'priority', 'trend', 'tradeoff', 'expectation', 'trust', 'opinion'];
const FREE_LICENSE = /^(CC0|Public domain|CC BY(-SA)? \d\.\d)/;
// County codes a local page may name (src/counties.ts), and DSP for the diaspora.
const COUNTIES = new Set([...readFileSync(join(redactor, 'src/counties.ts'), 'utf8').matchAll(/code: '([A-Z]+)'/g)].map((m) => m[1]));
const NEWS_DAYS = 14; // a news page older than this is flagged for the archive

// The pool questions the site serves (id → where, group) and each wiki page's source numbers.
const pool = new Map(Object.entries(buildPool(join(redactor, 'questions')).questions));
const wiki = new Map(
  readdirSync(join(redactor, 'wiki')).filter((f) => /^[a-z][a-z0-9-]*\.md$/.test(f)).map((f) => {
    const surse = readFileSync(join(redactor, 'wiki', f), 'utf8').split(/^## Surse\s*$/m)[1] ?? '';
    return [f.slice(0, -3), new Set([...surse.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1])))];
  }),
);
const wikiSources = (slug) => wiki.get(slug) ?? null;

const words = (s) => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z]{4,}/g) ?? []);
const jaccard = (a, b) => [...a].filter((x) => b.has(x)).length / (new Set([...a, ...b]).size || 1);

let errors = 0, warnings = 0;
const err = (f, msg) => (errors++, console.log(`✗ ${f}: ${msg}`));
const warn = (f, msg) => (warnings++, console.log(`! ${f}: ${msg}`));

const sets = [];
const quizOf = new Map(); // quiz id -> the page that names it
for (const f of readdirSync(root).filter((f) => /^[a-z][a-z0-9-]*\.md$/.test(f))) {
  let page;
  try {
    page = parsePage(readFileSync(join(root, f), 'utf8'));
  } catch (e) {
    err(f, e.message);
    continue;
  }
  // Its quiz, if it names one: a file in quizzes/, the quiz of this page only.
  const hasQuiz = page.data.quiz !== undefined;
  let questions = [];
  if (hasQuiz) {
    const id = String(page.data.quiz);
    const file = join(redactor, 'quizzes', `${id}.md`);
    if (!/^[a-z0-9-]+$/.test(id) || !existsSync(file)) err(f, `quiz: no file quizzes/${id}.md`);
    else if (quizOf.has(id)) err(f, `quiz ${id} is already the quiz of ${quizOf.get(id)}`);
    else {
      quizOf.set(id, f);
      try {
        questions = parseQuiz(readFileSync(file, 'utf8'));
      } catch (e) {
        err(`quizzes/${id}.md`, e.message);
      }
    }
  }
  // As the site reads it: the front matter with its quiz's questions and its articles (news).
  const { data: d, body } = published(page, questions);
  sets.push({ f, slug: f.slice(0, -3), ...d, body });
  if (page.data.news !== undefined) err(f, 'news belongs in the body, as Surse (pages/README.md), not the front matter');
  if (page.data.questions !== undefined) err(f, 'questions belong in its quiz, quizzes/<id>.md, not the front matter');
  const cited = [...page.cards.flatMap((x) => x.quotes.map((q) => q.source)), ...(page.data.stat?.quote ? [page.data.stat.source] : [])];
  for (const n of cited) if (!page.sources.some((s) => s.n === n)) err(f, `a quote cites [${n}], which is not in Surse`);

  for (const k of ['title', 'summary', 'tags']) if (d[k] === undefined) err(f, `missing ${k}`);
  const news = d.date !== undefined;
  if (!news && typeof d.order !== 'number') err(f, 'a page without a date needs an order');
  if (news && Number.isNaN(Date.parse(d.date))) err(f, `date "${d.date}" is not a date`);
  if (news && (Date.now() - Date.parse(d.date)) / 864e5 > NEWS_DAYS) warn(f, `news from ${d.date}, over ${NEWS_DAYS} days old`);
  if (d.title?.length > 32) err(f, `title over 32 characters`);
  if (d.summary?.length > 140) err(f, `summary over 140 characters (${d.summary.length})`);
  if (d.tags && (d.tags.length < 1 || d.tags.length > 3)) err(f, '1–3 tags');
  for (const t of d.tags ?? []) if (t !== t.toLowerCase()) err(f, `tag "${t}" not lowercase`);
  if (d.counties !== undefined) {
    if (!Array.isArray(d.counties) || !d.counties.length) err(f, 'counties must be a non-empty list, or absent for everyone');
    for (const c of d.counties ?? []) if (c !== 'DSP' && !COUNTIES.has(c)) err(f, `county "${c}" is not a code from counties.ts (or DSP)`);
    if (new Set(d.counties).size !== d.counties.length) err(f, 'a county listed twice');
  }
  if (!d.stat && !d.image) err(f, 'the cover needs a stat or an image');
  if (d.stat && (!d.stat.value || !d.stat.label)) err(f, 'stat needs value and label');
  // A neutral key figure (README, Rules): no verdict words, no comparison picked to judge, no opinions.
  const judging = `${d.stat?.label ?? ''}`.match(/(?<!\p{L})(prea|doar|numai|abia|record\p{L}*|criz\p{L}*|alarm\p{L}*|grav[ăe]?|dramatic\p{L}*|cel mai|cea mai|cei mai|cele mai|(spun|cred|consideră|declară) că|încredere)(?!\p{L})|\(UE|UE:/iu);
  if (judging) err(f, `stat: "${judging[0]}" judges the subject; the key figure gives its size (README, A neutral key figure)`);
  if (d.stat?.value?.length > 10) err(f, `stat value "${d.stat.value}" over 10 characters`);
  if (!body) err(f, 'no cards (## Carduri)');
  // Each card's data, as its kind is drawn (README, Cards): otherwise the site has nothing to draw.
  for (const c of page.cards) {
    const at = `card "${c.title}"`;
    const unit = (v) => v.replace(/[\d.,\s]+/g, ' ').trim();
    const rows = c.rows;
    const labelled = rows.every((r) => r.label);
    const numeric = rows.every((r) => /\d/.test(r.value));
    if (!c.text) err(f, `${at}: no sentence`);
    if (c.kind === 'cifră' && (rows.length !== 1 || !numeric)) err(f, `${at}: a figure is one item, - <value>`);
    if (c.kind === 'comparație' || c.kind === 'evoluție') {
      if (rows.length < 2 || !labelled || !numeric) err(f, `${at}: needs two or more items, - <label>: <value>`);
      else if (new Set(rows.map((r) => unit(r.value))).size > 1) err(f, `${at}: values in different units (${rows.map((r) => r.value).join(', ')}); one unit, so they can be drawn together`);
    }
    if (c.kind === 'parte') {
      const v = rows[0]?.value ?? '';
      const of = v.match(/^(\d+) din (\d+)$/);
      const pct = v.match(/^(\d+(?:,\d+)?)%$/);
      if (rows.length !== 1 || !(of ? Number(of[2]) <= 10 && Number(of[1]) <= Number(of[2]) : pct && Number(pct[1].replace(',', '.')) <= 100))
        err(f, `${at}: a share is one item, - <n>% or - <a> din <b> (b up to 10)`);
    }
    if (c.kind === 'clasament' && !/^\d+ din \d+$/.test(rows[0]?.value ?? '')) err(f, `${at}: a ranking starts with - <label>: <place> din <how many>`);
    if (c.kind === 'listă' && rows.length < 2) err(f, `${at}: a list needs two or more items, - <text> or - <label>: <text>`);
    if (['cronologie', 'voci'].includes(c.kind) && (rows.length < 2 || !labelled)) err(f, `${at}: needs two or more items, - <label>: <text>`);
    if (c.kind === 'text' && rows.length) err(f, `${at}: a text card has no items`);
  }

  if (d.image) {
    for (const k of ['src', 'alt', 'credit', 'license', 'url']) if (!d.image[k]) err(f, `image needs ${k}`);
    if (d.image.src && !/^\/photos\/[a-z0-9-]+\.jpg$/.test(d.image.src)) err(f, `image src "${d.image.src}" must be /photos/<file>.jpg`);
    else if (d.image.src && !existsSync(join(root, 'photos', basename(d.image.src)))) err(f, `no file pages/photos/${basename(d.image.src)}`);
    if (d.image.license && !FREE_LICENSE.test(d.image.license)) err(f, `image licence "${d.image.license}" is not a free licence`);
  } else if (news) err(f, 'a news page needs an image');

  if (news) {
    const outlets = new Set((d.news ?? []).map((n) => n.outlet));
    for (const n of d.news ?? []) if (!n.outlet || !n.title || !/^https:\/\//.test(n.url ?? '')) err(f, `news item needs outlet, title and an https url`);
    if (outlets.size < 2 && !(outlets.size === 1 && d.wiki && d.sources?.length)) err(f, 'a news page needs two outlets, or one and wiki sources');
  }

  if (d.wiki) {
    const sources = wikiSources(d.wiki);
    if (!sources) err(f, `no wiki page wiki/${d.wiki}.md`);
    else for (const n of d.sources ?? []) if (!sources.has(n)) err(f, `source ${n} not in the Surse list of wiki/${d.wiki}.md`);
  } else if (!news && !d.wiki) err(f, 'a page without a date needs a wiki page');

  const qs = d.questions ?? [];
  if (hasQuiz && (qs.length < 4 || qs.length > 8)) err(f, `${qs.length} questions in its quiz (4–8)`);
  const groups = new Map(), own = new Set();
  let home = 0, abroad = 0;
  for (const q of qs) {
    if (typeof q === 'object') {
      // A question written for this set: the shape and the parts of QUIZ.md a script can check.
      const at = `${f} question ${q.id ?? '?'}`;
      if (!/^[a-z0-9-]+$/.test(q.id ?? '')) err(at, 'id must be kebab-case');
      if (own.has(q.id)) err(at, 'id used twice');
      own.add(q.id);
      if (!['single', 'multi', 'scale', 'yesno'].includes(q.type)) err(at, `type ${q.type}`);
      if (!MEASURES.includes(q.measures)) err(at, `measures ${q.measures}`);
      if (!q.text) err(at, 'no text');
      if (q.text?.split(/\s+/).length > 30) err(at, 'over 30 words');
      if (['single', 'multi'].includes(q.type) && !(q.options?.length >= 2 && q.options.length <= 8)) err(at, '2–8 options');
      if (q.type === 'scale' && !(q.scale?.minLabel && q.scale?.maxLabel)) err(at, 'scale needs minLabel and maxLabel');
      const all = [q.text, q.na, ...(q.options ?? []).map((o) => o.label)].filter(Boolean).join(' ');
      if (/[şţŞŢ]/.test(all)) err(at, 'cedilla ş/ţ instead of comma-below ș/ț');
      if (/\bcam\b/i.test(all)) err(at, '"cam" in a question or option');
      if (q.outlook) {
        // As in the pool (questions/README.md): every non-na choice, each one of -1, -0.5, 0, 0.5, 1.
        const ids = q.type === 'scale' ? ['1', '2', '3', '4', '5'] : q.type === 'yesno' ? ['da', 'nu'] : (q.options ?? []).map((o) => o.id);
        if (q.type === 'multi') err(at, 'outlook on a multi-choice question');
        for (const id of ids) if (!(id in q.outlook)) err(at, `outlook misses choice ${id}`);
        for (const [id, v] of Object.entries(q.outlook)) {
          if (!ids.includes(id)) err(at, `outlook names unknown choice ${id}`);
          if (![-1, -0.5, 0, 0.5, 1].includes(v)) err(at, `outlook ${id}: ${v} (one of -1, -0.5, 0, 0.5, 1)`);
        }
      }
      if (q.where !== 'diaspora') home++;
      if (q.where !== 'romania') abroad++;
      continue;
    }
    const p = pool.get(q);
    if (!p) { err(f, `${q} is not a question the site serves (questions/)`); continue; }
    if (p.group) {
      if (groups.has(p.group)) err(f, `${q} and ${groups.get(p.group)} are the same question (group ${p.group})`);
      groups.set(p.group, q);
    }
    if (p.where !== 'diaspora') home++;
    if (p.where !== 'romania') abroad++;
  }
  // Who sees the page: residents, unless it is for the diaspora only.
  const dspOnly = d.counties?.length === 1 && d.counties[0] === 'DSP';
  if (hasQuiz && dspOnly && abroad < 3) err(f, `only ${abroad} questions for the diaspora (at least 3)`);
  if (hasQuiz && !dspOnly && home < 3) err(f, `only ${home} questions for residents (at least 3)`);
}

// A quiz no page names is shown nowhere.
for (const q of readdirSync(join(redactor, 'quizzes')).filter((q) => /^[a-z][a-z0-9-]*\.md$/.test(q)))
  if (!quizOf.has(q.slice(0, -3))) err(`quizzes/${q}`, 'no page names this quiz (quiz: <id> in its front matter)');

// Duplicates across pages.
const owner = new Map();
for (const s of sets)
  for (const id of (s.questions ?? []).filter((q) => typeof q === 'string')) {
    if (owner.has(id)) err(s.f, `${id} is already in ${owner.get(id)}`);
    else owner.set(id, s.f);
  }
const urls = new Map();
for (const s of sets)
  for (const n of s.news ?? []) {
    if (urls.has(n.url)) err(s.f, `the article ${n.url} is already in ${urls.get(n.url)}`);
    urls.set(n.url, s.f);
  }
const orders = new Map();
for (const s of sets.filter((s) => s.order !== undefined)) {
  if (orders.has(s.order)) warn(s.f, `same order as ${orders.get(s.order)}`);
  orders.set(s.order, s.f);
}
for (let i = 0; i < sets.length; i++)
  for (let j = i + 1; j < sets.length; j++) {
    const [a, b] = [sets[i], sets[j]];
    if (a.title && b.title && jaccard(words(`${a.title} ${a.summary}`), words(`${b.title} ${b.summary}`)) >= 0.4)
      err(b.f, `reads like ${a.f} (title and summary)`);
    if (a.stat?.label && a.stat.label === b.stat?.label) err(b.f, `same key figure as ${a.f}`);
  }

console.log(`${sets.length} pages (${sets.filter((s) => s.date).length} from the news), ${owner.size} pool questions: ${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
