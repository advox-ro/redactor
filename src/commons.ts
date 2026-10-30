// Photos from Wikimedia Commons, fetched by the Worker for the editor. The editor's session reaches
// the internet through an address many others share, which Commons rate-limits; the Worker asks
// from its own, with a User-Agent that says who is asking, as Wikimedia's API rules want.
//   GET /commons?q=<search>        up to 20 files: title, page, the 1400 px image, size, licence,
//                                  author and description, as Commons gives them
//   GET /commons/file?url=<url>    the image itself, from Wikimedia's image hosts only
const UA = 'advox-redactor/1.0 (https://advox.ro)';
const API = 'https://commons.wikimedia.org/w/api.php';

type Page = {
  title: string;
  imageinfo?: { thumburl?: string; thumbwidth?: number; thumbheight?: number; descriptionurl: string; mime: string; extmetadata?: Record<string, { value: string }> }[];
};
const plain = (html = '') => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

export async function searchCommons(q: string) {
  if (!q) throw new Error('q is required');
  const url = new URL(API);
  for (const [k, v] of Object.entries({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '20',
    gsrsearch: q,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size|mime',
    iiurlwidth: '1400',
  }))
    url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Commons: ${r.status}`);
  const pages = Object.values(((await r.json()) as { query?: { pages: Record<string, Page> } }).query?.pages ?? {});
  return pages.flatMap((p) => {
    const i = p.imageinfo?.[0];
    if (!i?.thumburl) return [];
    const m = i.extmetadata ?? {};
    return [
      {
        title: p.title,
        page: i.descriptionurl,
        image: i.thumburl,
        width: i.thumbwidth,
        height: i.thumbheight,
        mime: i.mime,
        license: plain(m.LicenseShortName?.value),
        author: plain(m.Artist?.value),
        description: plain(m.ImageDescription?.value).slice(0, 300),
      },
    ];
  });
}

export async function commonsFile(src: string) {
  const url = new URL(src);
  if (url.protocol !== 'https:' || !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname))
    throw new Error('url: only https://upload.wikimedia.org/… or https://thumb.wikimedia.org/…');
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Commons file: ${r.status}`);
  return new Response(r.body, { headers: { 'Content-Type': r.headers.get('Content-Type') ?? 'application/octet-stream' } });
}
