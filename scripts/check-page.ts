// Usage: npm run check-page -- <pages/slug.md>
// Fetches every article the page cites (its Surse list) and runs the checks in src/pagecheck.ts.
// Exits with 1 and lists the problems when the page fails; the editor fixes them before proposing it.
import { readFileSync } from 'node:fs';
import { articleText } from '../src/facts';
import { checkPage } from '../src/pagecheck';
import { parsePage } from '../src/pagefile';

const [file] = process.argv.slice(2);
if (!file) {
  console.error('usage: npm run check-page -- <pages/slug.md>');
  process.exit(2);
}
const page = parsePage(readFileSync(file, 'utf8'));
const urls = page.sources.map((s) => s.url);
const texts = new Map(await Promise.all(urls.map(async (u) => [u, await articleText(u)] as const)));
const problems = checkPage(page, texts);
if (problems.length) {
  console.log(`${problems.length} problems:\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`passes: ${urls.length} articles, every quote and number found`);
