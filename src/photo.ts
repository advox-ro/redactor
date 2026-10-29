// The cover photo, from Wikimedia Commons under a free licence (CC0, public domain, CC BY, CC BY-SA),
// never a press photo. Vox looks at the candidates and picks one that shows the subject and fits
// the story's tone, or none.
import { z } from 'zod';
import type { Photo } from './draft';
import type { Env } from './env';
import { plain } from './feeds';
import { ask } from './vox';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'redactor/1.0 (https://advox.ro)';
const FREE = /^(cc0|public domain|pd\b|cc by(-sa)? \d|cc-by(-sa)?-\d)/i;
const WIDTH = 1400;

type Candidate = { title: string; page: string; thumb: string; credit: string; license: string; description: string };

async function search(q: string): Promise<Candidate[]> {
  const url = new URL(API);
  for (const [k, v] of Object.entries({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrsearch: `${q} filetype:bitmap`, gsrlimit: '12',
    prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: String(WIDTH),
  })) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const pages = Object.values(((await res.json()) as { query?: { pages?: Record<string, any> } }).query?.pages ?? {});
  return pages.flatMap((p) => {
    const i = p.imageinfo?.[0];
    const m = i?.extmetadata ?? {};
    const license = plain(m.LicenseShortName?.value ?? '');
    if (!i || i.mime !== 'image/jpeg' || i.width < WIDTH || !FREE.test(license)) return [];
    const credit = plain(m.Artist?.value ?? m.Credit?.value ?? '').slice(0, 80);
    if (!credit) return [];
    return [{ title: p.title, page: i.descriptionurl, thumb: i.thumburl, credit, license, description: plain(m.ImageDescription?.value ?? '').slice(0, 200) }];
  });
}

const Choice = z.object({
  pick: z.number().nullable().describe('the number of the photo to use, or null if none fits'),
  illustrative: z.boolean().describe('true unless the photo shows the event itself'),
  alt: z.string().describe('Romanian, one line: what the photo shows'),
  reason: z.string(),
});

export async function findPhoto(env: Env, queries: string[], story: string): Promise<Photo | null> {
  const seen = new Set<string>();
  const cands: Candidate[] = [];
  for (const q of queries.slice(0, 3)) {
    for (const c of await search(q)) if (!seen.has(c.page) && seen.add(c.page)) cands.push(c);
    await new Promise((r) => setTimeout(r, 1500)); // Commons asks for few requests
  }
  const shown = cands.slice(0, 6);
  if (!shown.length) return null;
  const { data } = await ask(env, {
    job: 'photo',
    system: `You choose the cover photo for a quiz about a Romanian news story on advox.ro. Pick a photo that shows the story's subject (the place, the building, the object), with a tone that fits the story: nothing cheerful for a disaster. Reject photos with recognisable private people, party symbols, logos or watermarks. None is a good answer when nothing fits.`,
    content: [
      { type: 'text', text: `The story: ${story}` },
      ...shown.flatMap((c, i) => [
        { type: 'text' as const, text: `Photo ${i + 1}: ${c.title}. ${c.description}` },
        { type: 'image' as const, source: { type: 'url' as const, url: c.thumb } },
      ]),
    ],
    schema: Choice,
    effort: 'low',
  });
  const c = data.pick ? shown[data.pick - 1] : undefined;
  if (!c) return null;
  return { src: c.thumb, alt: data.alt, credit: c.credit, license: c.license, url: c.page, illustrative: data.illustrative };
}

/** The photo's bytes at 1400 px, as base64 for the pull request. */
export async function download(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`photo ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
