// Usage: npm run check-quiz -- <quizzes/slug.md>
// Fetches every article the quiz cites (its Surse list) and runs the checks in src/quizcheck.ts.
// Exits with 1 and lists the problems when the quiz fails; the editor fixes them before proposing it.
import { readFileSync } from 'node:fs';
import { articleText } from '../src/facts';
import { checkQuiz } from '../src/quizcheck';
import { parseQuiz } from '../src/quizfile';

const [file] = process.argv.slice(2);
if (!file) {
  console.error('usage: npm run check-quiz -- <quizzes/slug.md>');
  process.exit(2);
}
const quiz = parseQuiz(readFileSync(file, 'utf8'));
const urls = quiz.sources.map((s) => s.url);
const texts = new Map(await Promise.all(urls.map(async (u) => [u, await articleText(u)] as const)));
const problems = checkQuiz(quiz, texts);
if (problems.length) {
  console.log(`${problems.length} problems:\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`passes: ${urls.length} articles, every quote and number found`);
