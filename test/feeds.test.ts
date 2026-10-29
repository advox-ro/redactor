import { expect, test } from 'vitest';
import { canonical, parseFeed } from '../src/feeds';

test('RSS items with CDATA, HTML and tracking parameters', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Cod galben de ploi în Cluj]]></title>
    <link>https://exemplu.ro/stire?utm_source=rss&amp;id=5#top</link><pubDate>Thu, 29 Oct 2026 10:00:00 +0200</pubDate>
    <description><![CDATA[<p>ANM a emis &icirc;n această dimineaţă un cod galben.</p>]]></description><category>Vreme</category></item></channel></rss>`;
  const [i] = parseFeed(xml);
  expect(i.title).toBe('Cod galben de ploi în Cluj');
  expect(i.url).toBe('https://exemplu.ro/stire?id=5');
  expect(i.summary).toBe('ANM a emis în această dimineață un cod galben.');
  expect(i.published).toBe(Date.parse('2026-10-29T08:00:00Z'));
  expect(i.categories).toEqual(['Vreme']);
});

test('Atom entries', () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Titlu</title><link rel="alternate" href="https://exemplu.ro/a"/><updated>2026-10-29T08:00:00Z</updated><summary>Rezumat</summary></entry></feed>`;
  expect(parseFeed(xml)).toEqual([{ url: 'https://exemplu.ro/a', title: 'Titlu', summary: 'Rezumat', published: Date.parse('2026-10-29T08:00:00Z'), categories: [] }]);
});

test('canonical addresses drop fragments and tracking only', () => {
  expect(canonical('http://exemplu.ro/x?a=1&utm_medium=x&fbclid=y#z')).toBe('https://exemplu.ro/x?a=1');
});
