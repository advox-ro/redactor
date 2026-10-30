// The checks a news quiz must pass before the editor may propose it (scripts/check-quiz.ts runs
// them). Each fact in the quiz's body comes with the sentences of the articles it rests on, and the
// key figure may come with its own (src/quizfile.ts describes the layout). Every quote must be in
// its article word for word, every number must be in the quotes it rests on (the summary's and the
// key figure's, in any quote of the quiz), every article in Surse must back something, and the
// facts must come from two outlets; a quiz for the whole country, from two kinds of outlets.
import { loose, numbers } from './facts';
import type { QuizFile, Quote } from './quizfile';
import { BUCKET_OF, FEEDS } from './sources';

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

/** Every quote in the quiz: under its facts, and the key figure's. */
export function quotesOf(q: QuizFile): Quote[] {
  const stat = q.data.stat?.quote ? [{ quote: q.data.stat.quote, source: q.data.stat.source }] : [];
  return [...q.facts.flatMap((f) => f.quotes), ...stat];
}

/** Problems with the quiz; empty when it passes. texts: each article's text by address, as
 *  fetched (null when it couldn't be read). */
export function checkQuiz(q: QuizFile, texts: Map<string, string | null>): string[] {
  const p: string[] = [];
  const d = q.data;
  const byN = new Map(q.sources.map((s) => [s.n, s]));
  if (!d.date) p.push('a news quiz needs its date');

  const all = quotesOf(q);
  for (const x of all) {
    const s = byN.get(x.source);
    if (!s) {
      p.push(`[${x.source}] is not in Surse: "${x.quote}"`);
      continue;
    }
    const text = texts.get(s.url);
    if (text === null || text === undefined) p.push(`couldn't read ${s.url}: use an article that can be read`);
    else if (x.quote.length < 20 || !loose(text).includes(loose(x.quote))) p.push(`not in [${s.n}] ${s.url}, word for word: "${x.quote}"`);
  }

  q.facts.forEach((f, i) => {
    if (!f.quotes.length) p.push(`fact ${i + 1} has no quotes: "${f.text}"`);
    const ok = new Set(f.quotes.flatMap((x) => numbers(x.quote)));
    for (const n of numbers(f.text)) if (!ok.has(n)) p.push(`fact ${i + 1}: the number ${n} is not in its quotes`);
  });
  const anywhere = new Set(all.flatMap((x) => numbers(x.quote)));
  for (const n of numbers(d.summary ?? '')) if (!anywhere.has(n)) p.push(`summary: the number ${n} is not in any quote`);
  for (const n of numbers(d.stat ? `${d.stat.value} ${d.stat.label}` : '')) if (!anywhere.has(n)) p.push(`key figure: the number ${n} is not in any quote`);

  const used = new Set(all.map((x) => x.source));
  for (const s of q.sources) if (!used.has(s.n)) p.push(`[${s.n}] ${s.url} is in Surse but nothing rests on it`);
  const backing = q.sources.filter((s) => q.facts.some((f) => f.quotes.some((x) => x.source === s.n)));
  if (new Set(backing.map((s) => s.outlet)).size < 2) p.push('the facts rest on one outlet; two are needed');
  if (!d.counties?.length && new Set(backing.map((s) => kindOf(s.outlet, s.url))).size < 2)
    p.push('a quiz for the whole country needs its facts from two kinds of outlets (sources.ts)');
  return p;
}
