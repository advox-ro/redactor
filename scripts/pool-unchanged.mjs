// Usage: node scripts/pool-unchanged.mjs [base, default origin/main]
// The answers people gave are stored by question id, so a question already in the pool keeps what
// it asks: its type, text, options, scale, budget and "doesn't apply" answer stay as they are, and
// it isn't removed. New questions, and the other fields (tier, outlook, wiki, rationale, …), can
// change. Compares the question pool in the working tree with the one in base and fails on any
// such change. Run by the check job on the editor's content pull requests (check.yml).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'origin/main';
const MEANING = ['type', 'text', 'options', 'scale', 'budget', 'na'];
const files = execFileSync('git', ['ls-tree', '--name-only', base, 'questions/'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f.endsWith('.jsonl'));
const parse = (text) => new Map(text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).map((q) => [q.id, q]));

const problems = [];
for (const f of files) {
  const before = parse(execFileSync('git', ['show', `${base}:${f}`], { encoding: 'utf8' }));
  const after = existsSync(f) ? parse(readFileSync(f, 'utf8')) : new Map();
  for (const [id, q] of before) {
    const now = after.get(id);
    if (!now) {
      problems.push(`${id}: removed`);
      continue;
    }
    for (const k of MEANING) if (JSON.stringify(q[k] ?? null) !== JSON.stringify(now[k] ?? null)) problems.push(`${id}: ${k} changed`);
  }
}
if (problems.length) {
  console.error(`A question already asked must keep what it asks (scripts/pool-unchanged.mjs); add a new question instead:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('every existing question asks what it asked before');
