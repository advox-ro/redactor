import { expect, test } from 'vitest';
import { checkPage } from '../src/pagecheck';
import { parsePage } from '../src/pagefile';
import { parseQuiz } from '../src/quizfile';

const A = 'https://www.mediafax.ro/a';
const B = 'https://economedia.ro/b';
const texts = new Map([
  [A, 'Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august, pentru că Dunărea scăzuse prea mult.'],
  [B, 'Ministrul a spus că un reactor ar putea reporni în jurul datei de 15 noiembrie. Cernavodă produce de obicei 20% din curentul țării.'],
]);
const page = (cards: string, surse = `1. A — Mediafax. ${A}\n2. B — Economedia. ${B}`) =>
  parsePage(`---
title: Iarna fără Cernavodă
summary: Ambele reactoare stau oprite din vară.
date: 2026-10-27
stat: { value: "20%", label: din curentul țării vine de la Cernavodă, quote: "Cernavodă produce de obicei 20% din curentul țării", source: 2 }
---

## Carduri

${cards}

## Surse

${surse}
`);
const CARDS = `### Oprite din vară
tip: cronologie
- 28 iulie: unitatea 1
- 13 august: unitatea 2
Dunărea scăzuse prea mult.
> „Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august” [1]

### Când repornește
tip: text
Un reactor ar putea reporni în jurul datei de 15 noiembrie.
> „un reactor ar putea reporni în jurul datei de 15 noiembrie” [2]`;

test('a page whose cards are in its articles passes', () => {
  expect(checkPage(page(CARDS), texts)).toEqual([]);
});

test('a number the quotes do not hold is caught', () => {
  expect(checkPage(page(CARDS.replace('- 28 iulie', '- 29 iulie')), texts)).toContain('card "Oprite din vară": the number 29 is not in its quotes');
});

test('a quote that is not in the article is caught', () => {
  const q = page(CARDS.replace('„Unitatea 1 a fost oprită pe', '„Unitatea 1 a fost oprită definitiv pe'));
  expect(checkPage(q, texts)).toContain(`not in [1] ${A}, word for word: "Unitatea 1 a fost oprită definitiv pe 28 iulie, iar unitatea 2 pe 13 august"`);
});

test('an article that could not be read fails the page', () => {
  expect(checkPage(page(CARDS), new Map([[A, null], [B, texts.get(B)!]]))).toContain(`couldn't read ${A}: use an article that can be read`);
});

test('one outlet is not enough, and a national page needs two kinds of outlets', () => {
  const C = 'https://www.mediafax.ro/c';
  const p = checkPage(page(CARDS, `1. A — Mediafax. ${A}\n2. B — Mediafax. ${C}`), new Map([[A, texts.get(A)!], [C, texts.get(B)!]]));
  expect(p).toContain('the cards rest on one outlet; two are needed');
  expect(p).toContain('a page for the whole country needs its cards to rest on two kinds of outlets (sources.ts)');
});

test('an article nothing rests on, and a quote citing no article, are caught', () => {
  const C = 'https://www.digi24.ro/c';
  const p = checkPage(page(CARDS.replace('[2]', '[4]'), `1. A — Mediafax. ${A}\n2. B — Economedia. ${B}\n3. C — Digi24. ${C}`), texts);
  expect(p).toContain('[4] is not in Surse: "un reactor ar putea reporni în jurul datei de 15 noiembrie"');
  expect(p).toContain(`[3] ${C} is in Surse but nothing rests on it`);
});

test('the layout: cards with quotes, sources as in the wiki, the questions in the quiz', () => {
  const q = page(CARDS);
  expect(q.cards.map((c) => [c.kind, c.rows.length, c.quotes.length])).toEqual([['cronologie', 2, 1], ['text', 0, 1]]);
  expect(() => parsePage('---\ntitle: x\nquiz: x\n---\n\n## Întrebări\n\n- sanatate-001\n')).toThrow('unknown section');
  expect(q.sources[1]).toEqual({ n: 2, title: 'B', outlet: 'Economedia', url: B });
  expect(() => parsePage('---\ntitle: x\n---\n\nnot a card\n')).toThrow('text before the first section');
});

test('the article: paragraphs with their quotes, subheadings, the places of cards, every number in its quotes', () => {
  const ARTICLE = `${CARDS}

## Articol

Reactoarele stau oprite. Primul s-a oprit pe 28 iulie,
al doilea pe 13 august.
> „Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august” [1]

[card: Oprite din vară]

### Ce urmează

Un reactor ar putea reporni pe 16 noiembrie.
> „un reactor ar putea reporni în jurul datei de 15 noiembrie” [2]`;
  const q = page(ARTICLE);
  expect(q.article.map((b) => [b.kind, b.quotes.length])).toEqual([['text', 1], ['card', 0], ['heading', 0], ['text', 1]]);
  expect(q.article[0].text).toBe('Reactoarele stau oprite. Primul s-a oprit pe 28 iulie, al doilea pe 13 august.');
  expect(checkPage(q, texts)).toEqual(['article, paragraph 4: the number 16 is not in its quotes']);
});

test('questions in Markdown: pool ids, then the quiz\'s own, with their table of fields and numbered options', () => {
  expect(
    parseQuiz(`- sanatate-001

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
  expect(() => parseQuiz('### X?\n\n| colour | red |\n')).toThrow('colour is not a field');
  expect(() => parseQuiz('### X?\n\n| id | a |\n|---|---|\n\n- sanatate-001\n')).toThrow('not a field');
  expect(() => parseQuiz('### X?\n\n| id | a |\n\n1. Da\n3. Nu\n')).toThrow('option 3 is not number 2');
});
