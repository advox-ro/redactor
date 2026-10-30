// Usage: npm run questions-unchanged [-- base, default origin/main]
// The answers people gave are stored by question id (a pool question's own, or <slug>-<id> for a
// quiz's own question) and by option letter, so a question already published keeps what it asks:
// its type, text, options (in their order), scale, budget and "doesn't apply" answer stay as they
// are, and it isn't removed. New questions, and the other fields (tier, outlook, wiki, …), can
// change. Compares the question pool and the quizzes in the working tree with those in base. Run by
// the check job on every pull request (check.yml).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parseQuiz } from '../src/quizfile';

const base = process.argv[2] ?? 'origin/main';
const MEANING = ['type', 'text', 'options', 'scale', 'budget', 'na'];
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' });
const files = (dir: string, ext: RegExp) => git('ls-tree', '--name-only', base, `${dir}/`).split('\n').filter((f) => ext.test(f));

type Q = Record<string, unknown>;
const pool = (text: string) => new Map<string, Q>(text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).map((q: Q) => [q.id as string, q]));
const quiz = (text: string, slug: string) =>
  new Map<string, Q>(parseQuiz(text).questions.filter((q): q is Q => typeof q === 'object').map((q) => [`${slug}-${q.id}`, q]));

const problems: string[] = [];
function compare(before: Map<string, Q>, after: Map<string, Q>) {
  for (const [id, q] of before) {
    const now = after.get(id);
    if (!now) problems.push(`${id}: removed`);
    else for (const k of MEANING) if (JSON.stringify(q[k] ?? null) !== JSON.stringify(now[k] ?? null)) problems.push(`${id}: ${k} changed`);
  }
}
for (const f of files('questions', /\.jsonl$/)) compare(pool(git('show', `${base}:${f}`)), existsSync(f) ? pool(readFileSync(f, 'utf8')) : new Map());
// A quiz removed takes its questions out of the feed, not out of the answers: only quizzes still
// here are compared.
for (const f of files('quizzes', /^quizzes\/[a-z][a-z0-9-]*\.md$/).filter(existsSync)) {
  const slug = f.slice('quizzes/'.length, -3);
  compare(quiz(git('show', `${base}:${f}`), slug), quiz(readFileSync(f, 'utf8'), slug));
}
if (problems.length) {
  console.error(`A question already published must keep what it asks (scripts/questions-unchanged.ts); write a new question instead:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('every published question asks what it asked before');
