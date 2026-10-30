// Usage:
//   node scripts/propose.mjs <slug> <title> <body.md> [--message <commit message>]
//   node scripts/propose.mjs --content <slug> <title> <body.md> <file>… [--message <commit message>]
// Sends the editor's changes to the redactor, which commits them as advox-ro and opens the pull
// request (src/proposals.ts). A page: pages/<slug>.md, pages/photos/<slug>.jpg and its quiz,
// quizzes/<slug>.md (those that exist), on the branch page/<slug>. With --content: the wiki pages and question pool files named,
// on the branch content/<slug>. Run it again to push a fix to the same pull request. Prints the pull request's number and address. Reads REDACTOR_TOKEN.
// For the editor (EDITOR.md).
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args.splice(i, name === '--content' ? 1 : 2)[name === '--content' ? 0 : 1];
};
const message = flag('--message');
const kind = flag('--content') ? 'content' : 'page';
const [slug, title, bodyFile, ...named] = args;
const token = process.env.REDACTOR_TOKEN;
if (!slug || !title || !bodyFile || !token || (kind === 'content') !== named.length > 0) {
  console.error('usage: REDACTOR_TOKEN=… node scripts/propose.mjs [--content] <slug> <title> <body.md> [file…] [--message <message>]');
  process.exit(2);
}
const paths = kind === 'page' ? [`pages/${slug}.md`, `pages/photos/${slug}.jpg`, `quizzes/${slug}.md`].filter((p) => existsSync(p)) : named;
const files = Object.fromEntries(paths.map((p) => [p, readFileSync(p).toString('base64')]));
const r = await fetch('https://redactor.advox.ro/proposals', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ kind, slug, title, body: readFileSync(bodyFile, 'utf8'), message, files }),
});
const out = await r.json();
if (!r.ok) {
  console.error(out.error ?? out);
  process.exit(1);
}
console.log(`#${out.number} ${out.url}`);
