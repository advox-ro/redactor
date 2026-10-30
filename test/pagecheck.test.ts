import { expect, test } from 'vitest';
import { checkPage } from '../src/pagecheck';
import { parseQuestions, parsePage } from '../src/pagefile';

const A = 'https://www.mediafax.ro/a';
const B = 'https://economedia.ro/b';
const texts = new Map([
  [A, 'Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august, pentru că Dunărea scăzuse prea mult.'],
  [B, 'Ministrul a spus că un reactor ar putea reporni în jurul datei de 15 noiembrie. Cernavodă produce de obicei 20% din curentul țării.'],
]);
const page = (facts: string, surse = `1. A — Mediafax. ${A}\n2. B — Economedia. ${B}`) =>
  parsePage(`---
title: Iarna fără Cernavodă
summary: Ambele reactoare stau oprite din vară.
date: 2026-10-27
stat: { value: "20%", label: din curentul țării vine de la Cernavodă, quote: "Cernavodă produce de obicei 20% din curentul țării", source: 2 }
---

${facts}

## Întrebări

### Da?

| id | a |
|---|---|
| type | yesno |
| measures | opinion |

## Surse

${surse}
`);
const FACTS = `- Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august.
  > „Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august” [1]
- Un reactor ar putea reporni în jurul datei de 15 noiembrie.
  > „un reactor ar putea reporni în jurul datei de 15 noiembrie” [2]`;

test('a page whose facts are in its articles passes', () => {
  expect(checkPage(page(FACTS), texts)).toEqual([]);
});

test('a number the quotes do not hold is caught', () => {
  expect(checkPage(page(FACTS.replace('- Unitatea 1 a fost oprită pe 28', '- Unitatea 1 a fost oprită pe 29')), texts)).toContain('fact 1: the number 29 is not in its quotes');
});

test('a quote that is not in the article is caught', () => {
  const q = page(FACTS.replace('„Unitatea 1 a fost oprită pe', '„Unitatea 1 a fost oprită definitiv pe'));
  expect(checkPage(q, texts)).toContain(`not in [1] ${A}, word for word: "Unitatea 1 a fost oprită definitiv pe 28 iulie, iar unitatea 2 pe 13 august"`);
});

test('an article that could not be read fails the page', () => {
  expect(checkPage(page(FACTS), new Map([[A, null], [B, texts.get(B)!]]))).toContain(`couldn't read ${A}: use an article that can be read`);
});

test('one outlet is not enough, and a national page needs two kinds of outlets', () => {
  const C = 'https://www.mediafax.ro/c';
  const p = checkPage(page(FACTS, `1. A — Mediafax. ${A}\n2. B — Mediafax. ${C}`), new Map([[A, texts.get(A)!], [C, texts.get(B)!]]));
  expect(p).toContain('the facts rest on one outlet; two are needed');
  expect(p).toContain('a page for the whole country needs its facts from two kinds of outlets (sources.ts)');
});

test('an article nothing rests on, and a quote citing no article, are caught', () => {
  const C = 'https://www.digi24.ro/c';
  const p = checkPage(page(FACTS.replace('[2]', '[4]'), `1. A — Mediafax. ${A}\n2. B — Economedia. ${B}\n3. C — Digi24. ${C}`), texts);
  expect(p).toContain('[4] is not in Surse: "un reactor ar putea reporni în jurul datei de 15 noiembrie"');
  expect(p).toContain(`[3] ${C} is in Surse but nothing rests on it`);
});

test('the layout: facts with quotes, the questions, sources as in the wiki', () => {
  const q = page(FACTS);
  expect(q.facts.map((f) => f.quotes.length)).toEqual([1, 1]);
  expect(q.questions).toEqual([{ id: 'a', type: 'yesno', measures: 'opinion', text: 'Da?' }]);
  expect(q.sources[1]).toEqual({ n: 2, title: 'B', outlet: 'Economedia', url: B });
  expect(() => parsePage('---\ntitle: x\n---\n\nnot a fact\n')).toThrow('not a fact');
});

test('questions in Markdown: pool ids, then the page\'s own, with their table of fields and numbered options', () => {
  expect(
    parseQuestions(`- sanatate-001

### Cât de îngrijorat(ă) ești?

| id | factura |
|---|---|
| type | scale |
| scale | Deloc … Foarte |
| outlook | 1: 1, 2: 0.5, 5: -1 |
| na | Nu plătesc eu |

### Cu ce te încălzești?

| id | incalzire |
|---|---|
| type | multi |
| maxSelect | 2 |

1. Gaz (centrală)
2. Lemne
`),
  ).toEqual([
    'sanatate-001',
    { text: 'Cât de îngrijorat(ă) ești?', id: 'factura', type: 'scale', scale: { minLabel: 'Deloc', maxLabel: 'Foarte' }, outlook: { 1: 1, 2: 0.5, 5: -1 }, na: 'Nu plătesc eu' },
    { text: 'Cu ce te încălzești?', id: 'incalzire', type: 'multi', maxSelect: 2, options: [{ id: 'a', label: 'Gaz (centrală)' }, { id: 'b', label: 'Lemne' }] },
  ]);
  expect(() => parseQuestions('### X?\n\n| colour | red |\n')).toThrow('colour is not a field');
  expect(() => parseQuestions('### X?\n\n| id | a |\n|---|---|\n\n- sanatate-001\n')).toThrow('not a field');
  expect(() => parseQuestions('### X?\n\n| id | a |\n\n1. Da\n3. Nu\n')).toThrow('option 3 is not number 2');
});
