// Builds the published content into the Worker. Wrangler runs it before every deploy and dev
// session (wrangler.jsonc, "build"), so deploying publishes. It writes to src/generated/:
//   pages.json    pages/*.md, each page's front matter and its quiz's questions as data, its cards' text as HTML
//   wiki.json     wiki/*.md as the site shows them: front matter, HTML, headings and sources
//   quiz.json     the question pool, questions/*.jsonl, as the site's older quiz reads it (pool.mjs)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { parse } from 'yaml';
import citations from './citations.mjs';
import { buildPool } from './pool.mjs';
import privateSections from './private-sections.mjs';
import safeMarkdown from './safe-markdown.mjs';
import { parsePage, published } from '../src/pagefile';
import { parseQuiz } from '../src/quizfile';

const front = (file: string) => {
  const m = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file} has no front matter`);
  return { data: parse(m[1]), body: m[2] };
};
// Lowercase names only: README.md is each folder's index on GitHub, not content.
const markdownFiles = (dir: string) => readdirSync(dir).filter((f) => /^[a-z][a-z0-9-]*\.md$/.test(f));

// A page as the site reads it (src/pagefile.ts): its data, with the questions of the quiz it names
// (quizzes/<id>.md, src/quizfile.ts), and its cards' titles and sentences, without their quotes, as HTML, through the same
// Markdown processor as the wiki, without its plugins.
const plain = await createSatteriMarkdownProcessor({ syntaxHighlight: false });
const pages = [];
for (const f of markdownFiles('pages')) {
  const page = parsePage(readFileSync(`pages/${f}`, 'utf8'));
  const quiz = page.data.quiz && parseQuiz(readFileSync(`quizzes/${page.data.quiz}.md`, 'utf8'));
  const { data, body } = published(page, quiz || []);
  pages.push({ slug: f.slice(0, -3), data, html: (await plain.render(body)).code });
}

// The wiki goes through the same Markdown processor, with the same plugins, as the site's own pages
// (Astro's Sätteri processor): [n] citations link to the "Surse" list (citations.mjs), and the
// "Idei de întrebări" notes stay in the files but off the site (private-sections.mjs).
const markdown = await createSatteriMarkdownProcessor({ syntaxHighlight: false, mdastPlugins: [safeMarkdown, privateSections], hastPlugins: [citations] });
const wiki = [];
for (const f of markdownFiles('wiki')) {
  const { data, body } = front(`wiki/${f}`);
  for (const k of ['title', 'summary', 'updated', 'order']) if (data[k] === undefined) throw new Error(`wiki/${f} has no ${k}`);
  const { code, metadata } = await markdown.render(body).catch((e) => {
    throw new Error(`wiki/${f}: ${e.message}`);
  });
  // The "Surse" list: "n. Title — Publisher. https://…", which pages cite by number.
  const sources = [...(body.split(/^## Surse\s*$/m)[1] ?? '').matchAll(/^(\d+)\. (.+)$/gm)].map(([, n, line]) => {
    const url = line.match(/https?:\/\/\S+$/)?.[0];
    return { n: Number(n), text: url ? line.slice(0, -url.length).trim() : line, ...(url && { url }) };
  });
  wiki.push({ slug: f.slice(0, -3), data: { ...data, updated: String(data.updated) }, html: code, headings: metadata.headings, sources });
}
wiki.sort((a, b) => a.data.order - b.data.order);

const pool = buildPool();

mkdirSync('src/generated', { recursive: true });
writeFileSync('src/generated/pages.json', JSON.stringify(pages));
writeFileSync('src/generated/wiki.json', JSON.stringify(wiki));
writeFileSync('src/generated/quiz.json', JSON.stringify(pool));
console.log(`${pages.length} pages, ${wiki.length} wiki pages and ${Object.keys(pool.questions).length} pool questions built into the Worker`);
