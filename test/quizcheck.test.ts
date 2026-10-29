import { expect, test } from 'vitest';
import { checkQuiz, type Evidence } from '../src/quizcheck';

const A = 'https://www.mediafax.ro/a';
const B = 'https://economedia.ro/b';
const texts = new Map([
  [A, 'Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august, pentru că Dunărea scăzuse prea mult.'],
  [B, 'Ministrul a spus că un reactor ar putea reporni în jurul datei de 15 noiembrie. Cernavodă produce de obicei 20% din curentul țării.'],
]);
const md = (body: string, extra = '') => `---
title: Iarna fără Cernavodă
summary: Ambele reactoare stau oprite din vară.
date: 2026-10-27
stat: { value: "20%", label: din curentul țării vine de la Cernavodă }
${extra}news:
  - { outlet: Mediafax, title: A, url: "${A}" }
  - { outlet: Economedia, title: B, url: "${B}" }
---

${body}`;
const good = md('- Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august.\n- Un reactor ar putea reporni în jurul datei de 15 noiembrie.\n');
const ev: Evidence = {
  facts: [[{ url: A, quote: 'Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august' }], [{ url: B, quote: 'un reactor ar putea reporni în jurul datei de 15 noiembrie' }]],
  stat: [{ url: B, quote: 'Cernavodă produce de obicei 20% din curentul țării' }],
};

test('a quiz whose facts are in its articles passes', () => {
  expect(checkQuiz(good, ev, texts)).toEqual([]);
});

test('a number the quotes do not hold is caught', () => {
  const bad = good.replace('28 iulie', '29 iulie');
  expect(checkQuiz(bad, ev, texts)).toContain('fact 1: the number 29 is not in its quotes');
});

test('a quote that is not in the article is caught', () => {
  const e = { ...ev, facts: [[{ url: A, quote: 'Unitatea 1 a fost oprită definitiv pe 28 iulie' }], ev.facts[1]] };
  expect(checkQuiz(good, e, texts)).toContain(`not in ${A}, word for word: "Unitatea 1 a fost oprită definitiv pe 28 iulie"`);
});

test('an article that could not be read fails the quiz', () => {
  expect(checkQuiz(good, ev, new Map([[A, null], [B, texts.get(B)!]]))).toContain(`couldn't read ${A}: use an article that can be read`);
});

test('one outlet is not enough, and a national quiz needs two kinds of outlets', () => {
  const one = good.replace('outlet: Economedia', 'outlet: Mediafax').replace(B, 'https://www.mediafax.ro/c');
  const e = { facts: [ev.facts[0], [{ url: 'https://www.mediafax.ro/c', quote: ev.facts[1][0].quote }]] };
  const t = new Map([[A, texts.get(A)!], ['https://www.mediafax.ro/c', texts.get(B)!]]);
  const p = checkQuiz(one, e, t);
  expect(p).toContain('the facts rest on one outlet; two are needed');
  expect(p).toContain('a quiz for the whole country needs its facts from two kinds of outlets (sources.ts)');
});

test('the news list and the evidence must match', () => {
  const e = { ...ev, facts: [ev.facts[0], [{ url: A, quote: 'pentru că Dunărea scăzuse prea mult' }]] };
  expect(checkQuiz(md('- Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august.\n- Dunărea scăzuse prea mult.\n'), e, texts)).toContain(`${B} is in the news list but no fact rests on it`);
});
