// The editor's pages as they stand on their branch (page/<slug>), before they are merged: read from
// GitHub and published as the build publishes them (scripts/content.ts), for the site's preview
// address (advox.ro/preview/<slug>?branch=page/<slug>), which draws them as readers will see them.
// GET /preview/<slug> photographs that address for the branch page/<slug>, so the editor can look
// at its cards before the checks merge them (EDITOR.md): every card one under another, on a phone
// (?width=1280 for a laptop).
import puppeteer from '@cloudflare/puppeteer';
import type { Env } from './env';
import { parsePage, published } from './pagefile';
import { fileAt, OURS } from './proposals';
import { parseQuiz } from './quizfile';

const SITE = 'https://advox.ro';
const text = (b: ArrayBuffer | null) => b && new TextDecoder().decode(b);
const slugOf = (branch: string) => (branch.startsWith('page/') ? branch.slice(5) : null);

/** The page on one of the editor's page branches, as the site reads a published page, or null. */
export async function draft(env: Env, branch: string) {
  const slug = OURS(branch) && slugOf(branch);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null;
  const md = text(await fileAt(env, `pages/${slug}.md`, branch));
  if (!md) return null;
  const page = parsePage(md);
  const quiz = page.data.quiz && text(await fileAt(env, `quizzes/${page.data.quiz}.md`, branch));
  const { data } = published(page, quiz ? parseQuiz(quiz) : []);
  return { slug, data, html: '' };
}

/** The page's photo on its branch, or null. */
export async function draftPhoto(env: Env, branch: string): Promise<Response | null> {
  const slug = OURS(branch) && slugOf(branch);
  if (!slug) return null;
  const jpg = await fileAt(env, `pages/photos/${slug}.jpg`, branch);
  return jpg && new Response(jpg, { headers: { 'Content-Type': 'image/jpeg' } });
}

/** A picture of the cards of the page on the branch page/<slug>, as a PNG. */
export async function previewShot(env: Env, slug: string, width: number): Promise<Response> {
  if (!(await draft(env, `page/${slug}`))) return Response.json({ error: `no page on the branch page/${slug}` }, { status: 404 });
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const tab = await browser.newPage();
    await tab.setViewport({ width, height: width < 768 ? 844 : 800, deviceScaleFactor: width < 768 ? 2 : 1 });
    await tab.goto(`${SITE}/preview/${slug}?branch=page/${slug}`, { waitUntil: 'networkidle0' });
    const png = await tab.screenshot({ fullPage: true, type: 'png' });
    return new Response(png, { headers: { 'Content-Type': 'image/png' } });
  } finally {
    await browser.close();
  }
}
