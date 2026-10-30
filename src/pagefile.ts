// A page file, pages/<slug>.md (pages/README.md): a short front matter, which names the page's quiz
// if it has one (`quiz: <id>`, quizzes/<id>.md, quizfile.ts), then the body.
//   ## Carduri      the cards the site shows: for each, `### Title`,
//                   `tip: <kind>`, its data as `- label: value` items, a sentence or two, and on a
//                   news page the quotes it rests on, `> „…” [n]` (pages/README.md)
//   ## Surse        a news page's articles, as in the wiki: `n. Title — Outlet. https://…`
// The build (scripts/content.ts), the validator (pages/validate.mjs) and the page check
// (pagecheck.ts) all read pages through parsePage.
import { parse } from 'yaml';
import type { Question } from './quizfile';

export type Quote = { quote: string; source: number };
export type Source = { n: number; title: string; outlet: string; url: string };
export type Row = { label?: string; value: string };
export type Card = { title: string; kind: string; rows: Row[]; text: string; quotes: Quote[] };
export type PageFile = {
  data: Record<string, any>; // the front matter
  cards: Card[];
  sources: Source[];
};

const SECTIONS = ['Carduri', 'Surse'];
/** The kinds of card the site draws (pages/README.md). */
export const KINDS = ['cifră', 'comparație', 'parte', 'clasament', 'evoluție', 'cronologie', 'voci', 'listă', 'text'];
const QUOTE = /^\s*> „(.*)” \[(\d+)\]\s*$/;

function parseCards(md: string): Card[] {
  const cards: Card[] = [];
  for (const block of md.split(/^### /m).slice(1)) {
    const [title, ...lines] = block.split('\n');
    const card: Card = { title: title.trim(), kind: 'text', rows: [], text: '', quotes: [] };
    const text: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const kind = t.match(/^tip:\s*(.+)$/);
      const q = t.startsWith('>') && line.match(QUOTE);
      if (kind) {
        if (!KINDS.includes(kind[1].trim())) throw new Error(`card "${card.title}": unknown kind "${kind[1]}" (${KINDS.join(', ')})`);
        card.kind = kind[1].trim();
      } else if (t.startsWith('>')) {
        if (!q) throw new Error(`card "${card.title}": not a quote (> „…” [n]): ${t}`);
        card.quotes.push({ quote: q[1], source: Number(q[2]) });
      } else if (t.startsWith('- ')) {
        const r = t.slice(2).match(/^(.+?):\s+(.+)$/);
        card.rows.push(r ? { label: r[1].trim(), value: r[2].trim() } : { value: t.slice(2).trim() });
      } else text.push(t);
    }
    card.text = text.join(' ');
    if (!card.title) throw new Error('a card without a title (### …)');
    cards.push(card);
  }
  return cards;
}

/** Throws, with the line at fault, when the file doesn't follow the layout. */
export function parsePage(md: string): PageFile {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('no front matter');
  const data = parse(m[1]) ?? {};
  const [head, ...rest] = m[2].split(/^## /m);
  const sections = new Map<string, string>();
  for (const s of rest) {
    const name = s.split('\n', 1)[0].trim();
    if (!SECTIONS.includes(name)) throw new Error(`unknown section "## ${name}" (${SECTIONS.join(', ')})`);
    sections.set(name, s.slice(s.indexOf('\n') + 1));
  }

  if (head.trim()) throw new Error(`text before the first section (## Carduri): ${head.trim().split('\n')[0]}`);

  const sources = (sections.get('Surse') ?? '').split('\n').filter((l) => l.trim()).map((l) => {
    const s = l.match(/^(\d+)\. (.+) — ([^—]+?)\. (https?:\/\/\S+)$/);
    if (!s) throw new Error(`not a source (n. Title — Outlet. https://…): ${l}`);
    return { n: Number(s[1]), title: s[2], outlet: s[3], url: s[4] };
  });
  return { data, cards: parseCards(sections.get('Carduri') ?? ''), sources };
}

/** The page as the site reads it: the front matter with its quiz's questions (none without a quiz),
 *  its articles (news) and its cards with the numbers of the articles they rest on, without their
 *  quotes; and the cards as plain Markdown text, their titles and sentences. */
export function published(q: PageFile, questions: Question[] = []): { data: Record<string, any>; body: string } {
  const { quote, source, ...stat } = q.data.stat ?? {};
  const data: Record<string, any> = { ...q.data, questions };
  if (q.data.stat) data.stat = stat;
  if (q.sources.length) data.news = q.sources.map(({ outlet, title, url }) => ({ outlet, title, url }));
  data.cards = q.cards.map(({ quotes, ...c }) => ({ ...c, sources: [...new Set(quotes.map((x) => x.source))] }));
  return { data, body: q.cards.map((c) => `- **${c.title}.** ${c.text}`).join('\n') };
}
