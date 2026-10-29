// The checks a news quiz must pass before the editor may propose it (scripts/check-quiz.ts runs
// them). Each fact in the quiz's body comes with the sentences it rests on, as evidence:
//   { "facts": [[{ "url": "…", "quote": "…" }], …], "summary": [{ … }], "stat": [{ … }] }
// one list per fact, in the order of the body, plus the sentences behind any number in the summary
// or the key figure. Every quote must be in its article word for word, every number must be in the
// quotes it rests on, every article must be in the quiz's news list and the other way round, and
// the facts must come from two outlets; a quiz for the whole country, from two kinds of outlets.
import { parse } from 'yaml';
import { loose, numbers } from './facts';
import { BUCKET_OF, FEEDS } from './sources';

export type Quote = { url: string; quote: string };
export type Evidence = { facts: Quote[][]; summary?: Quote[]; stat?: Quote[] };

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};
const KIND_BY_HOST = new Map(FEEDS.map((f) => [host(f.url), f.kind]));

/** The kind of outlet (sources.ts), by its name as in the feeds, else by its address. */
export function kindOf(outlet: string, url: string): string {
  return BUCKET_OF[outlet] ?? KIND_BY_HOST.get(host(url)) ?? `other:${host(url)}`;
}

/** Problems with the quiz and its evidence; empty when it passes. texts: each article's text by
 *  address, as fetched (null when it couldn't be read). */
export function checkQuiz(md: string, ev: Evidence, texts: Map<string, string | null>): string[] {
  const p: string[] = [];
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return ['the file has no front matter'];
  const d = parse(m[1]) as { summary?: string; stat?: { value: string; label: string }; counties?: string[]; date?: unknown; news?: { outlet: string; url: string }[] };
  const facts = m[2].split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());

  if (!d.date) p.push('a news quiz needs its date');
  if (facts.length !== ev.facts.length) p.push(`the body has ${facts.length} facts and the evidence ${ev.facts.length} lists`);

  const all = [...ev.facts.flat(), ...(ev.summary ?? []), ...(ev.stat ?? [])];
  for (const q of all) {
    const text = texts.get(q.url);
    if (text === null || text === undefined) p.push(`couldn't read ${q.url}: use an article that can be read`);
    else if (q.quote.length < 20 || !loose(text).includes(loose(q.quote))) p.push(`not in ${q.url}, word for word: "${q.quote}"`);
  }

  facts.forEach((f, i) => {
    const quotes = ev.facts[i] ?? [];
    if (!quotes.length) p.push(`fact ${i + 1} has no evidence: "${f}"`);
    const ok = new Set(quotes.flatMap((q) => numbers(q.quote)));
    for (const n of numbers(f)) if (!ok.has(n)) p.push(`fact ${i + 1}: the number ${n} is not in its quotes`);
  });
  const anywhere = new Set(all.flatMap((q) => numbers(q.quote)));
  for (const n of numbers(d.summary ?? '')) if (!anywhere.has(n)) p.push(`summary: the number ${n} is not in any quote`);
  for (const n of numbers(d.stat ? `${d.stat.value} ${d.stat.label}` : '')) if (!anywhere.has(n)) p.push(`key figure: the number ${n} is not in any quote`);

  const news = d.news ?? [];
  const listed = new Set(news.map((n) => n.url));
  const used = new Set(ev.facts.flat().map((q) => q.url));
  for (const u of used) if (!listed.has(u)) p.push(`${u} is cited but not in the news list`);
  for (const n of news) if (!used.has(n.url)) p.push(`${n.url} is in the news list but no fact rests on it`);
  const outlets = new Set(news.filter((n) => used.has(n.url)).map((n) => n.outlet));
  if (outlets.size < 2) p.push('the facts rest on one outlet; two are needed');
  if (!d.counties?.length) {
    const kinds = new Set(news.filter((n) => used.has(n.url)).map((n) => kindOf(n.outlet, n.url)));
    if (kinds.size < 2) p.push('a quiz for the whole country needs its facts from two kinds of outlets (sources.ts)');
  }
  return p;
}
