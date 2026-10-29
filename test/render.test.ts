import { parse } from 'yaml';
import { expect, test } from 'vitest';
import { mechanical } from '../src/checks';
import { render, type Brief, type Draft } from '../src/draft';

export const brief: Brief = {
  storyId: 1,
  day: '2026-10-27',
  scope: 'national',
  angle: 'Cum își încălzesc oamenii casa și cât îi îngrijorează factura.',
  claims: [
    { id: 11, articleId: 1, outlet: 'Mediafax', url: 'https://www.mediafax.ro/a', title: 'Ambele reactoare rămân oprite', text: 'Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august.', quote: '' },
    { id: 12, articleId: 2, outlet: 'Economedia', url: 'https://economedia.ro/b', title: 'Un reactor ar putea fi repornit', text: 'Un reactor ar putea reporni în jurul datei de 15 noiembrie.', quote: '' },
    { id: 13, articleId: 2, outlet: 'Economedia', url: 'https://economedia.ro/b', title: 'Un reactor ar putea fi repornit', text: 'Cernavodă produce de obicei 20% din curentul țării.', quote: '' },
  ],
};

export const draft: Draft = {
  slug: 'iarna-fara-cernavoda',
  title: 'Iarna fără Cernavodă',
  summary: 'Ambele reactoare stau oprite din vară. Cum îți încălzești casa și cât te îngrijorează factura.',
  tags: ['energie', 'facturi'],
  stat: { value: '20%', label: 'din curentul țării vine, de obicei, de la Cernavodă' },
  facts: [
    { text: 'Unitatea 1 a fost oprită pe 28 iulie, iar unitatea 2 pe 13 august.', claims: [11] },
    { text: 'Un reactor ar putea reporni în jurul datei de 15 noiembrie.', claims: [12] },
  ],
  questions: [
    { id: 'incalzire', type: 'single', measures: 'experience', where: 'romania', text: 'Cu ce îți încălzești în principal locuința în această iarnă?', options: [{ id: 'a', label: 'Centrală proprie pe gaz' }, { id: 'b', label: 'Termoficare' }, { id: 'c', label: 'Altfel' }], maxSelect: null, scale: null, na: null, outlook: null },
    { id: 'factura', type: 'scale', measures: 'expectation', where: 'romania', text: 'Cât de îngrijorat(ă) ești că factura ta la curent va crește în această iarnă?', options: [], maxSelect: null, scale: { minLabel: 'Deloc îngrijorat(ă)', maxLabel: 'Foarte îngrijorat(ă)' }, na: 'Nu plătesc eu factura la curent', outlook: [{ choice: '1', value: 1 }, { choice: '2', value: 0.5 }, { choice: '3', value: 0 }, { choice: '4', value: -0.5 }, { choice: '5', value: -1 }] },
    { id: 'intreruperi', type: 'scale', measures: 'trust', where: 'romania', text: 'Câtă încredere ai că în această iarnă nu vor fi întreruperi de curent în zona ta?', options: [], maxSelect: null, scale: { minLabel: 'Deloc', maxLabel: 'Foarte multă' }, na: null, outlook: null },
    { id: 'consum', type: 'multi', measures: 'experience', where: 'all', text: 'Ce faci în această toamnă ca să consumi mai puțin curent? Alege cel mult două.', options: [{ id: 'a', label: 'Sting aparatele' }, { id: 'b', label: 'Am schimbat becurile' }, { id: 'c', label: 'Nimic diferit' }], maxSelect: 2, scale: null, na: null, outlook: null },
  ],
  photo: { queries: ['Cernavoda nuclear power plant'], alt: 'Centrala de la Cernavodă' },
};

test('a good draft passes the checks', () => {
  expect(mechanical(draft, brief)).toEqual([]);
});

test('the file is the site format', () => {
  const md = render(draft, brief, { src: '/quizzes/cernavoda-oprita.jpg', alt: 'Centrala', credit: 'IAEA Imagebank', license: 'CC BY 2.0', url: 'https://commons.wikimedia.org/wiki/File:X.jpg', illustrative: true });
  const [, yaml, body] = md.match(/^---\n([\s\S]*?)---\n\n([\s\S]*)$/)!;
  const d = parse(yaml);
  expect(d.date).toBe('2026-10-27');
  expect(d.news).toEqual([
    { outlet: 'Mediafax', title: 'Ambele reactoare rămân oprite', url: 'https://www.mediafax.ro/a' },
    { outlet: 'Economedia', title: 'Un reactor ar putea fi repornit', url: 'https://economedia.ro/b' },
  ]);
  expect(d.questions[1].outlook).toEqual({ '1': 1, '2': 0.5, '3': 0, '4': -0.5, '5': -1 });
  expect(d.questions[3].where).toBeUndefined();
  expect(body.trim().split('\n')).toHaveLength(2);
  expect(md).toContain('  - { id: a, label: Centrală proprie pe gaz }');
});

test('a number not in the cited claims is caught', () => {
  const bad = { ...draft, facts: [{ text: 'Unitatea 1 a fost oprită pe 29 iulie.', claims: [11] }, draft.facts[1]] };
  expect(mechanical(bad, brief)).toContain('the number 29 in "Unitatea 1 a fost oprită pe 29 iulie." is not in the claims it cites');
});

test('one outlet is not enough', () => {
  const one = { ...draft, facts: [{ text: draft.facts[1].text, claims: [12] }, { text: 'Cernavodă produce de obicei 20% din curentul țării.', claims: [13] }] };
  expect(mechanical(one, brief)).toContain('the facts rest on one outlet; two are needed');
});
