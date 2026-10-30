// A quiz, quizzes/<id>.md (quizzes/README.md): the questions a page asks, apart from the page,
// which names its quiz in its front matter (`quiz: <id>`). In order: pool ids as a list
// (`- sanatate-001`), then the quiz's own questions, each a `### ` heading with its text, and under
// it a table of its fields (`| type | single |`) and its options as a numbered list (`1. …`).
// Answers are stored by question: a pool question's id, or <quiz id>-<id> for the quiz's own.

/** A pool question's id, or a question of the quiz's own. */
export type Question = string | Record<string, any>;

// A question's fields, as written in its table (`| name | value |`), and how each is read.
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

/** A quiz file's questions: pool ids, then its own questions. Throws, with the line at fault, when
 *  the file doesn't follow the layout. */
export function parseQuiz(text: string): Question[] {
  const out: Question[] = [];
  let q: Record<string, any> | null = null;
  for (const line of text.split('\n').map((l) => l.trimEnd()).filter(Boolean)) {
    const heading = line.match(/^### (.+)$/);
    if (heading) {
      out.push((q = { text: heading[1].trim() }));
      continue;
    }
    if (!q) {
      const id = line.match(/^- ([a-z0-9-]+)$/)?.[1];
      if (!id) throw new Error(`not a pool question id (pool ids come before the quiz's own questions): ${line}`);
      out.push(id);
      continue;
    }
    // An option: its number is its place, and the answers store it as a letter (1 → a, 2 → b, …).
    const option = line.match(/^(\d+)\. (.+)$/);
    if (option) {
      const options = (q.options ??= []);
      if (Number(option[1]) !== options.length + 1) throw new Error(`"${q.text}": option ${option[1]} is not number ${options.length + 1}`);
      options.push({ id: String.fromCharCode(96 + Number(option[1])), label: option[2].trim() });
      continue;
    }
    const cells = line.match(/^\|(.*)\|$/)?.[1].split('|').map((c) => c.trim());
    if (!cells || cells.length !== 2) throw new Error(`"${q.text}": not a field (| name | value |) or an option (1. …): ${line}`);
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue; // the line under the table's first row
    const [name, value] = cells;
    if (!FIELDS[name]) throw new Error(`"${q.text}": ${name} is not a field (${Object.keys(FIELDS).join(', ')})`);
    if (name in q) throw new Error(`"${q.text}": ${name} twice`);
    q[name] = FIELDS[name](value);
  }
  return out;
}
