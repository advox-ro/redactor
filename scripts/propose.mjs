// Usage: node scripts/propose.mjs <slug> <title> <body.md> [commit message]
// Sends the quiz to the redactor, which commits quizzes/<slug>.md, quizzes/photos/<slug>.jpg and
// quizzes/evidence/<slug>.json (those that exist) to the branch quiz/<slug> as advox-ro and opens
// its pull request (src/proposals.ts). Run it again to push a fix to the same pull request. Prints
// the pull request's number and address. Reads REDACTOR_TOKEN. For the editor (EDITOR.md).
import { existsSync, readFileSync } from 'node:fs';

const [slug, title, bodyFile, message] = process.argv.slice(2);
const token = process.env.REDACTOR_TOKEN;
if (!slug || !title || !bodyFile || !token) {
  console.error('usage: REDACTOR_TOKEN=… node scripts/propose.mjs <slug> <title> <body.md> [commit message]');
  process.exit(2);
}
const files = {};
for (const path of [`quizzes/${slug}.md`, `quizzes/photos/${slug}.jpg`, `quizzes/evidence/${slug}.json`]) {
  if (existsSync(path)) files[path] = readFileSync(path).toString('base64');
}
const r = await fetch('https://redactor.advox.ro/proposals', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug, title, body: readFileSync(bodyFile, 'utf8'), message, files }),
});
const out = await r.json();
if (!r.ok) {
  console.error(out.error ?? out);
  process.exit(1);
}
console.log(`#${out.number} ${out.url}`);
