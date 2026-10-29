import { expect, test } from 'vitest';
import { countiesIn } from '../src/counties';

test('counties by name, town and with Romanian endings', () => {
  expect(countiesIn('Cod galben de ploi în județul Cluj')).toEqual(['CJ']);
  expect(countiesIn('Spitalul Județean Craiova primește aparatură nouă')).toEqual(['DJ']);
  expect(countiesIn('Primăria Clujului anunță lucrări')).toEqual(['CJ']);
  expect(countiesIn('Trafic restricționat la Cernavodă')).toEqual(['CT']);
  expect(countiesIn('Accident pe DN1, între Ploiești și Brașov').sort()).toEqual(['BV', 'PH']);
});

test('no county from common words', () => {
  expect(countiesIn('România a primit deja fondurile')).toEqual([]);
  expect(countiesIn('Casa Albă a anunțat noi tarife')).toEqual([]);
  expect(countiesIn('Românii plătesc mai mult pe energie')).toEqual([]);
});
