// A quiz file, quizzes/<slug>.md (quizzes/README.md): a short front matter, then the body.
//   the facts       a list, one fact per item; under a news quiz's fact, the sentences of the
//                   articles it rests on, word for word: `  > „…” [n]`, n from the Surse list
//   ## Întrebări    the questions, in order: pool ids as a list (`- sanatate-001`), then the quiz's
//                   own questions, each a `### ` heading with its text, and under it a list of its
//                   fields (`- type: single`) and options (`- a) …`), as parseQuestions reads them
//   ## Surse        a news quiz's articles, as in the wiki: `n. Title — Outlet. https://…`
// The build (scripts/content.ts), the validator (quizzes/validate.mjs) and the fact check
// (quizcheck.ts) all read quizzes through parseQuiz.
import { parse } from 'yaml';

export type Quote = { quote: string; source: number };
export type Fact = { text: string; quotes: Quote[] };
export type Source = { n: number; title: string; outlet: string; url: string };
export type QuizFile = {
  data: Record<string, any>; // the front matter
  facts: Fact[];
  questions: (string | Record<string, any>)[];
  sources: Source[];
};

const SECTIONS = ['Întrebări', 'Surse'];

/** Throws, with the line at fault, when the file doesn't follow the layout. */
export function parseQuiz(md: string): QuizFile {
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

  const facts: Fact[] = [];
  for (const line of head.split('\n')) {
    if (line.startsWith('- ')) facts.push({ text: line.slice(2).trim(), quotes: [] });
    else if (/^\s+>/.test(line)) {
      const q = line.match(/^\s+> „(.*)” \[(\d+)\]\s*$/);
      if (!q || !facts.length) throw new Error(`not a quote under a fact (  > „…” [n]): ${line.trim()}`);
      facts.at(-1)!.quotes.push({ quote: q[1], source: Number(q[2]) });
    } else if (line.trim()) throw new Error(`not a fact (- …) or a quote: ${line.trim()}`);
  }

  const questions = parseQuestions(sections.get('Întrebări') ?? '');

  const sources = (sections.get('Surse') ?? '').split('\n').filter((l) => l.trim()).map((l) => {
    const s = l.match(/^(\d+)\. (.+) — ([^—]+?)\. (https?:\/\/\S+)$/);
    if (!s) throw new Error(`not a source (n. Title — Outlet. https://…): ${l}`);
    return { n: Number(s[1]), title: s[2], outlet: s[3], url: s[4] };
  });
  return { data, facts, questions, sources };
}

// A question's fields, as written after "- name: ", and how each is read.
const FIELDS: Record<string, (v: string) => unknown> = {
  id: String,
  type: String,
  measures: String,
  where: String,
  na: String,
  group: String,
  maxSelect: Number,
  ageRanges: (v) => v.split(/,\s*/),
  // "Deloc … Foarte mult"
  scale: (v) => {
    const [minLabel, maxLabel, ...rest] = v.split(' … ');
    if (!maxLabel || rest.length) throw new Error(`scale: "lowest … highest", not "${v}"`);
    return { minLabel, maxLabel };
  },
  // "1: -1, 2: -0.5, 3: 0"
  outlook: (v) =>
    Object.fromEntries(
      v.split(/,\s*/).map((pair) => {
        const m = pair.match(/^([a-z0-9]+): (-?[\d.]+)$/);
        if (!m) throw new Error(`outlook: "choice: value, …", not "${pair}"`);
        return [m[1], Number(m[2])];
      }),
    ),
};

/** The questions of a quiz, from its "## Întrebări" section: pool ids, then its own questions. */
export function parseQuestions(text: string): QuizFile['questions'] {
  const out: QuizFile['questions'] = [];
  let q: Record<string, any> | null = null;
  for (const line of text.split('\n').map((l) => l.trimEnd()).filter(Boolean)) {
    const heading = line.match(/^### (.+)$/);
    if (heading) {
      out.push((q = { text: heading[1].trim() }));
      continue;
    }
    const item = line.match(/^- (.+)$/)?.[1];
    if (!item) throw new Error(`not a question, a field or an option: ${line}`);
    if (!q) {
      if (!/^[a-z0-9-]+$/.test(item)) throw new Error(`not a pool question id (pool ids come before the quiz's own questions): ${item}`);
      out.push(item);
      continue;
    }
    const option = item.match(/^([a-z0-9]+)\) (.+)$/);
    if (option) {
      (q.options ??= []).push({ id: option[1], label: option[2] });
      continue;
    }
    const field = item.match(/^([a-zA-Z]+): (.+)$/);
    if (!field || !FIELDS[field[1]]) throw new Error(`"${q.text}": not a field (${Object.keys(FIELDS).join(', ')}) or an option (a) …): ${item}`);
    if (field[1] in q) throw new Error(`"${q.text}": ${field[1]} twice`);
    q[field[1]] = FIELDS[field[1]](field[2]);
  }
  return out;
}

/** The quiz as the site reads it: the front matter with its questions and its articles (news), and
 *  the facts alone, without their quotes, as Markdown. */
export function published(q: QuizFile): { data: Record<string, any>; facts: string } {
  const { quote, source, ...stat } = q.data.stat ?? {};
  const data: Record<string, any> = { ...q.data, questions: q.questions };
  if (q.data.stat) data.stat = stat;
  if (q.sources.length) data.news = q.sources.map(({ outlet, title, url }) => ({ outlet, title, url }));
  return { data, facts: q.facts.map((f) => `- ${f.text}`).join('\n') };
}
