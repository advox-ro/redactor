// Checking a fact against its source: the sentence it comes from must be in the article, word for
// word, and every number in the fact must be in that sentence. Used by the page check
// (scripts/check-page.ts), which the editor runs before proposing a page.
import { plain } from './feeds';

const UA = 'Mozilla/5.0 (compatible; redactor; +https://advox.ro)';

/** The article's paragraphs as plain text, or null when the page can't be read. */
export async function articleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(15_000), redirect: 'follow' });
    if (!res.ok) return null;
    const html = await res.text();
    const paras = [...html.matchAll(/<p[\s>][\s\S]*?<\/p>/gi)].map((m) => plain(m[0])).filter((p) => p.length > 60);
    const text = paras.join('\n');
    return text.length > 300 ? text : null;
  } catch {
    return null;
  }
}

/** Text compared loosely: case, spacing, quote marks, dashes and old cedilla letters don't count. */
export function loose(s: string): string {
  return s
    .normalize('NFC')
    .replace(/ş/g, 'ș').replace(/ţ/g, 'ț').replace(/Ş/g, 'Ș').replace(/Ţ/g, 'Ț')
    .replace(/[„”“"«»‘’'`]/g, '')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/** The numbers in a text, written the same way: "1.055", "20%", "15 noiembrie" → ["1055", "20", "15"]. */
export function numbers(s: string): string[] {
  return [...s.matchAll(/\d[\d.,]*\d|\d/g)].map((m) => m[0].replace(/\.(?=\d{3}(\D|$))/g, '').replace(/,/g, '.').replace(/\.0+$/, ''));
}

/** A claim stands when its quote is in the article and every number it states is in the quote. */
export function verify(claim: string, quote: string, article: string): boolean {
  if (quote.length < 20 || !loose(article).includes(loose(quote))) return false;
  const inQuote = new Set(numbers(quote));
  return numbers(claim).every((n) => inQuote.has(n));
}
