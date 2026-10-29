// The published quizzes, as built into the Worker at deploy (scripts/content.ts), and what the site
// reads of them through the Content entrypoint (index.ts): the list, and each quiz's photo.
import built from './generated/quizzes.json';
import type { Env } from './env';

/** A quiz as written in quizzes/<slug>.md: data is its front matter (quizzes/README.md), html its facts. */
export type Quiz = { slug: string; data: Record<string, unknown>; html: string };

export const QUIZZES = built as Quiz[];

/** A photo from quizzes/photos/, or null. */
export async function photo(env: Env, file: string): Promise<Response | null> {
  if (!/^[a-z0-9-]+\.jpg$/.test(file)) return null;
  const res = await env.ASSETS.fetch(new Request(`https://assets/${file}`));
  return res.ok ? res : null;
}
