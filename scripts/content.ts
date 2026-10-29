// Builds the published quizzes into the Worker: reads quizzes/*.md and writes
// src/generated/quizzes.json, each quiz's front matter as data and its facts as HTML. Wrangler runs
// it before every deploy and dev session (wrangler.jsonc, "build"), so deploying publishes.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';
import { parse } from 'yaml';

const quizzes = readdirSync('quizzes')
  .filter((f) => /^[a-z][a-z0-9-]*\.md$/.test(f))
  .map((f) => {
    const md = readFileSync(`quizzes/${f}`, 'utf8');
    const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) throw new Error(`quizzes/${f} has no front matter`);
    return { slug: f.slice(0, -3), data: parse(m[1]), html: marked.parse(m[2].trim(), { async: false }) };
  });
mkdirSync('src/generated', { recursive: true });
writeFileSync('src/generated/quizzes.json', JSON.stringify(quizzes));
console.log(`${quizzes.length} quizzes built into the Worker`);
