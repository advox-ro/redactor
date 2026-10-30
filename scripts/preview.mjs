// Usage: node scripts/preview.mjs <slug> [--wide]
// Shows the editor a page as readers will see it, before proposing it: sends pages/<slug>.md, its
// photo and its quiz to the redactor, which commits them to the branch page/<slug> without opening
// a pull request (src/proposals.ts, draft), then saves a picture of its cards, as advox.ro draws
// them, one under another on a phone (--wide: on a laptop), to /tmp/<slug>-cards.png
// (src/preview.ts). Prints the picture's path. Reads REDACTOR_TOKEN. For the editor (EDITOR.md).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [slug, wide] = process.argv.slice(2);
const token = process.env.REDACTOR_TOKEN;
if (!slug || !token) {
  console.error('usage: REDACTOR_TOKEN=… node scripts/preview.mjs <slug> [--wide]');
  process.exit(2);
}
const auth = { Authorization: `Bearer ${token}` };
const paths = [`pages/${slug}.md`, `pages/photos/${slug}.jpg`, `quizzes/${slug}.md`].filter((p) => existsSync(p));
const files = Object.fromEntries(paths.map((p) => [p, readFileSync(p).toString('base64')]));
const sent = await fetch('https://redactor.advox.ro/proposals', {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug, title: slug, body: slug, message: `Ciornă: ${slug}`, draft: true, files }),
});
if (!sent.ok) {
  console.error((await sent.json()).error);
  process.exit(1);
}
const shot = await fetch(`https://redactor.advox.ro/preview/${slug}${wide === '--wide' ? '?width=1280' : ''}`, { headers: auth });
if (!shot.ok) {
  console.error(await shot.text());
  process.exit(1);
}
const file = `/tmp/${slug}-cards${wide === '--wide' ? '-wide' : ''}.png`;
writeFileSync(file, Buffer.from(await shot.arrayBuffer()));
console.log(file);
