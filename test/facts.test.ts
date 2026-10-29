import { expect, test } from 'vitest';
import { numbers, verify } from '../src/facts';

const article = 'Unitatea 1 a fost oprită pe 28 iulie. Secretarul de stat a spus că nu se așteaptă ca prețul curentului să crească cu mai mult de 20%. În total, 1.055 de localități au deficit de medici.';

test('numbers are written the same way however the text writes them', () => {
  expect(numbers('1.055 de localități, 20%, 6,5 la sută, 15 noiembrie 2026')).toEqual(['1055', '20', '6.5', '15', '2026']);
});

test('a claim stands when its quote is in the article and its numbers are in the quote', () => {
  const quote = 'nu se așteaptă ca prețul curentului să crească cu mai mult de 20%';
  expect(verify('Prețul curentului nu ar trebui să crească cu mai mult de 20%.', quote, article)).toBe(true);
});

test('a quote with old cedilla letters or other quote marks still matches', () => {
  expect(verify('Unitatea 1 a fost oprită pe 28 iulie.', 'Unitatea 1 a fost oprită pe 28 iulie', article.replace(/ț/g, 'ţ'))).toBe(true);
});

test('a number that is not in the quote fails the claim', () => {
  expect(verify('Prețul curentului ar putea crește cu 30%.', 'nu se așteaptă ca prețul curentului să crească cu mai mult de 20%', article)).toBe(false);
});

test('a quote that is not in the article fails the claim', () => {
  expect(verify('Prețul crește cu 20%.', 'prețul curentului va crește cu 20% de la 1 ianuarie', article)).toBe(false);
});
