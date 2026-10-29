// Usage: npm run check-quiz -- <quizzes/slug.md> <evidence.json>
// Fetches every article the evidence cites and runs the checks in src/quizcheck.ts. Exits with 1
// and lists the problems when the quiz fails; the editor fixes them before proposing it.
import { readFileSync } from 'node:fs';
import { articleText } from '../src/facts';
import { checkQuiz, type Evidence } from '../src/quizcheck';

const [quiz, evidence] = process.argv.slice(2);
if (!quiz || !evidence) {
  console.error('usage: npm run check-quiz -- <quiz.md> <evidence.json>');
  process.exit(2);
}
const md = readFileSync(quiz, 'utf8');
const ev = JSON.parse(readFileSync(evidence, 'utf8')) as Evidence;
const urls = [...new Set([...ev.facts.flat(), ...(ev.summary ?? []), ...(ev.stat ?? [])].map((q) => q.url))];
const texts = new Map(await Promise.all(urls.map(async (u) => [u, await articleText(u)] as const)));
const problems = checkQuiz(md, ev, texts);
if (problems.length) {
  console.log(`${problems.length} problems:\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`passes: ${urls.length} articles, every quote and number found`);
