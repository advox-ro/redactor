// The question pool as the site reads it (quiz.json), from questions/*.jsonl:
// questions, choices, axes and topics. Built into the Worker at deploy by scripts/content.ts; the
// site reads it through the Content entrypoint (src/index.ts). The site stores answers by question
// and choice id.
import { readFileSync, readdirSync } from 'node:fs';

const TYPES = new Set(['single', 'yesno', 'scale', 'multi']); // what the quiz UI can show

// Axes: each groups one or more wiki domains.
const AXES = [
  { id: 'viata', label: 'Viața ta', domains: ['romania-pe-scurt'] },
  { id: 'bani', label: 'Bani și trai', domains: ['economie', 'social'] },
  { id: 'munca', label: 'Muncă', domains: ['demografie-munca-diaspora'] },
  { id: 'sanatate', label: 'Sănătate', domains: ['sanatate'] },
  { id: 'educatie', label: 'Educație', domains: ['educatie'] },
  { id: 'stat', label: 'Stat și justiție', domains: ['justitie-administratie', 'politica'] },
  { id: 'infra', label: 'Infrastructură și mediu', domains: ['infrastructura', 'energie-mediu-agricultura'] },
  { id: 'siguranta', label: 'Siguranță și încredere', domains: ['securitate-media'] },
  { id: 'local', label: 'Localitatea ta', domains: ['regiuni'] },
];
const axisOf = (domain) => AXES.findIndex((a) => a.domains.includes(domain));

function choicesOf(q) {
  const list =
    q.type === 'yesno'
      ? [{ id: 'da', label: 'Da' }, { id: 'nu', label: 'Nu' }]
      : q.type === 'scale'
        ? [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: n === 1 ? q.scale.minLabel : n === 5 ? q.scale.maxLabel : String(n) }))
        : q.options.map((o) => ({ id: o.id, label: o.label }));
  return q.na ? [...list, { id: 'na', label: q.na }] : list;
}

/** quiz.json from the .jsonl files in `dir`. */
export function buildPool(dir = 'questions') {
  const questions = readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .flatMap((f) => readFileSync(`${dir}/${f}`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)))
    .filter((q) => TYPES.has(q.type));

  const manifest = {
    axes: AXES.map(({ id, label }) => ({ id, label })),
    questions: {},
    topics: AXES.slice(1).map((a) => a.id), // what the first question offers: every axis but "Viața ta"
  };
  for (const q of questions) {
    manifest.questions[q.id] = {
      domain: q.domain,
      tier: q.tier,
      type: q.type,
      text: q.text,
      ...(q.maxSelect && { maxSelect: q.maxSelect }),
      ...(q.scale && { scale: q.scale }),
      axis: axisOf(q.domain),
      ...(q.measures && { measures: q.measures }),
      ...(q.profile && { profile: true }),
      ...(q.group && { group: q.group }),
      ...(q.where && { where: q.where }),
      ...(q.outlook && { outlook: q.outlook }),
      choices: choicesOf(q).map((c) => ({ id: c.id, label: c.label })),
    };
  }
  return manifest;
}
