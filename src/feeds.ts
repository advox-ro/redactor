// Reading RSS 2.0 and Atom feeds into plain items. Feeds differ in small ways (CDATA, HTML in the
// summary, a link as text or as an attribute); this turns them all into the same shape.
import { XMLParser } from 'fast-xml-parser';

export type FeedItem = {
  url: string;
  title: string;
  summary: string;
  published: number | null; // ms since the epoch
  categories: string[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  cdataPropName: false,
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
});

const list = <T>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

/** The text of a node that may be a string, a number or { '#text': … }. */
function text(x: unknown): string {
  if (x === undefined || x === null) return '';
  if (typeof x === 'string' || typeof x === 'number') return String(x);
  if (typeof x === 'object' && '#text' in (x as object)) return text((x as { '#text': unknown })['#text']);
  return '';
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', bdquo: '„', rdquo: '”', ldquo: '“', rsquo: '’', lsquo: '‘', icirc: 'î', Icirc: 'Î', acirc: 'â', Acirc: 'Â', abreve: 'ă', Abreve: 'Ă', scedil: 'ș', Scedil: 'Ș', tcedil: 'ț', Tcedil: 'Ț', eacute: 'é', ouml: 'ö', uuml: 'ü', auml: 'ä' };

/** Plain text from a summary that may hold HTML and entities, on one line. */
export function plain(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? ENTITIES[n.toLowerCase()] ?? m)
    // Cedilla ş ţ to the comma-below letters Romanian uses.
    .replace(/ş/g, 'ș').replace(/Ş/g, 'Ș').replace(/ţ/g, 'ț').replace(/Ţ/g, 'Ț')
    .replace(/\s+/g, ' ')
    .trim();
}

function date(s: string): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/** The address without tracking parameters or a fragment, so the same article is stored once. */
export function canonical(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|src$)/i.test(k)) u.searchParams.delete(k);
    u.protocol = 'https:';
    return u.toString();
  } catch {
    return url.trim();
  }
}

export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml);
  const items: FeedItem[] = [];
  // RSS 2.0 (and RSS 1.0/RDF, whose items sit next to the channel).
  const rss = doc.rss?.channel ?? doc['rdf:RDF'];
  if (rss) {
    for (const it of [...list(rss.item), ...list(doc['rdf:RDF']?.item ?? [])]) {
      const url = text(it.link) || text(it.guid);
      if (!url) continue;
      items.push({
        url: canonical(url),
        title: plain(text(it.title)),
        summary: plain(text(it.description) || text(it['content:encoded'])).slice(0, 1200),
        published: date(text(it.pubDate) || text(it['dc:date'])),
        categories: list(it.category).map((c) => plain(text(c))).filter(Boolean),
      });
    }
  }
  // Atom.
  for (const e of list(doc.feed?.entry)) {
    const links = list(e.link);
    const link = links.find((l: { '@rel'?: string }) => !l['@rel'] || l['@rel'] === 'alternate') ?? links[0];
    const url = typeof link === 'object' ? link['@href'] : text(link);
    if (!url) continue;
    items.push({
      url: canonical(url),
      title: plain(text(e.title)),
      summary: plain(text(e.summary) || text(e.content)).slice(0, 1200),
      published: date(text(e.published) || text(e.updated)),
      categories: list(e.category).map((c: { '@term'?: string }) => c['@term'] ?? '').filter(Boolean),
    });
  }
  return items.filter((i) => i.title);
}
