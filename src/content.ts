// The published content, as built into the Worker at deploy (scripts/content.ts), and what the site
// reads of it through the Content entrypoint (index.ts): the quizzes and their photos, the wiki and
// the question pool.
import builtQuizzes from './generated/quizzes.json';
import builtWiki from './generated/wiki.json';
import builtPool from './generated/quiz.json';
import type { Env } from './env';

/** A quiz as written in quizzes/<slug>.md: data is its front matter (quizzes/README.md), html its facts. */
export type Quiz = { slug: string; data: Record<string, unknown>; html: string };

/** A wiki page, wiki/<slug>.md, as the site shows it: its front matter (updated as YYYY-MM-DD), its
 *  HTML, its headings (for the table of contents) and the numbered list under "Surse". */
export type WikiPage = {
  slug: string;
  data: { title: string; summary: string; updated: string; order: number };
  html: string;
  headings: { depth: number; slug: string; text: string }[];
  sources: { n: number; text: string; url?: string }[];
};

/** The question pool as the site's older quiz reads it (scripts/pool.mjs, questions/README.md). */
export type Pool = {
  axes: { id: string; label: string }[];
  questions: Record<string, Record<string, unknown> & { domain: string; text: string; choices: { id: string; label: string }[] }>;
  topics: string[];
};

export const QUIZZES = builtQuizzes as Quiz[];
/** In their order. */
export const WIKI = builtWiki as WikiPage[];
export const POOL = builtPool as Pool;

/** A photo from quizzes/photos/, or null. */
export async function photo(env: Env, file: string): Promise<Response | null> {
  if (!/^[a-z0-9-]+\.jpg$/.test(file)) return null;
  const res = await env.ASSETS.fetch(new Request(`https://assets/${file}`));
  return res.ok ? res : null;
}
