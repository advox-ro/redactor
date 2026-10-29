// What a draft must pass before it becomes a pull request. First the rules code can check (lengths,
// counts, the format, every number traced to a verified claim, two kinds of outlets); then an
// independent review by Vox in a fresh context, which sees the finished quiz, the rules and the
// claims, never how the draft was made.
import { z } from 'zod';
import { CODES } from './counties';
import type { Brief, Draft } from './draft';
import type { Env } from './env';
import { numbers } from './facts';
import { file } from './github';
import { BUCKET_OF } from './sources';
import { ask } from './vox';

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Problems code can see. Empty: the draft passes. */
export function mechanical(d: Draft, b: Brief): string[] {
  const p: string[] = [];
  const claim = new Map(b.claims.map((c) => [c.id, c]));
  const all = new Set(b.claims.flatMap((c) => numbers(c.text)));

  if (!KEBAB.test(d.slug) || d.slug.length > 40) p.push(`slug "${d.slug}" must be kebab-case, at most 40 characters`);
  if ([...d.title].length > 32) p.push(`title is ${[...d.title].length} characters, at most 32`);
  if ([...d.summary].length > 140) p.push(`summary is ${[...d.summary].length} characters, at most 140`);
  if (d.tags.length < 1 || d.tags.length > 3 || d.tags.some((t) => t !== t.toLowerCase())) p.push('1–3 lowercase tags');
  if (d.stat && [...d.stat.value].length > 10) p.push(`the key figure "${d.stat.value}" is longer than 10 characters`);
  if (d.facts.length < 2 || d.facts.length > 3) p.push(`${d.facts.length} facts, 2–3 needed`);

  // Every number traced to the claims: a fact's to its own claims, the summary's and the figure's to any.
  for (const f of d.facts) {
    const cited = f.claims.map((id) => claim.get(id));
    if (!f.claims.length || cited.some((c) => !c)) p.push(`the fact "${f.text}" cites a claim that doesn't exist`);
    const ok = new Set(cited.flatMap((c) => (c ? numbers(c.text) : [])));
    for (const n of numbers(f.text)) if (!ok.has(n)) p.push(`the number ${n} in "${f.text}" is not in the claims it cites`);
    if (f.text.includes('?')) p.push(`a fact asks the reader a question: "${f.text}"`);
  }
  for (const [what, text] of [['summary', d.summary], ['key figure', d.stat ? `${d.stat.value} ${d.stat.label}` : '']] as const)
    for (const n of numbers(text)) if (!all.has(n)) p.push(`the number ${n} in the ${what} is not in any claim`);

  // Two outlets, from two kinds of outlets for a national quiz.
  const used = d.facts.flatMap((f) => f.claims).map((id) => claim.get(id)).filter((c) => !!c);
  const outlets = new Set(used.map((c) => c.outlet));
  if (outlets.size < 2) p.push('the facts rest on one outlet; two are needed');
  if (b.scope === 'national' && new Set([...outlets].map((o) => BUCKET_OF[o] ?? o)).size < 2) p.push('the facts rest on one kind of outlet; a national quiz needs two');
  if (b.scope !== 'national' && b.scope.some((c) => !CODES.has(c))) p.push(`unknown county code in ${b.scope.join(', ')}`);

  // The questions.
  const qs = d.questions;
  if (qs.length < 4 || qs.length > 6) p.push(`${qs.length} questions, 4–6 needed`);
  if (new Set(qs.map((q) => q.id)).size !== qs.length) p.push('two questions share an id');
  if (qs.filter((q) => q.where !== 'diaspora').length < 3) p.push('fewer than 3 questions a resident can answer');
  for (const q of qs) {
    const at = `question "${q.id}"`;
    if (!KEBAB.test(q.id)) p.push(`${at}: the id must be kebab-case`);
    if ((q.type === 'single' || q.type === 'multi') && (q.options.length < 2 || q.options.length > 8)) p.push(`${at}: 2–8 options`);
    if ((q.type === 'scale' || q.type === 'yesno') && q.options.length) p.push(`${at}: a ${q.type} question has no options`);
    if (q.type === 'scale' && !q.scale) p.push(`${at}: a scale needs its two end labels`);
    if (q.type !== 'multi' && q.maxSelect) p.push(`${at}: maxSelect is for multi questions only`);
    if (q.options.some((o) => /^cam\b/i.test(o.label))) p.push(`${at}: no "cam" in an option`);
    if (new Set(q.options.map((o) => o.id)).size !== q.options.length) p.push(`${at}: two options share an id`);
    if (q.outlook) {
      const ids = q.type === 'scale' ? ['1', '2', '3', '4', '5'] : q.type === 'yesno' ? ['da', 'nu'] : q.options.map((o) => o.id);
      for (const o of q.outlook) {
        if (!ids.includes(o.choice)) p.push(`${at}: outlook names choice "${o.choice}", which doesn't exist`);
        if (![-1, -0.5, 0, 0.5, 1].includes(o.value)) p.push(`${at}: outlook values are -1, -0.5, 0, 0.5 or 1`);
      }
    }
  }
  // Romanian letters: ș and ț with a comma below, not the old cedilla forms.
  if (/[şţŞŢ]/.test(JSON.stringify(d))) p.push('use ș and ț (comma below), not ş and ţ');
  return p;
}

const Review = z.object({
  issues: z.array(
    z.object({
      part: z.string().describe('which part: the title, the summary, a fact, or a question id'),
      rule: z.string().describe('the rule it breaks, e.g. "QUIZ 4 neutral" or "facts as reported"'),
      problem: z.string(),
      fix: z.string().describe('the change that would fix it'),
    }),
  ),
  bias: z.string().describe('how a supporter and a critic of the government would each attack the quiz as biased, and whether either has a point'),
});

const REVIEW = (readme: string, rules: string) => `You review a quiz drafted for advox.ro, an anonymous survey about everyday life in Romania, before a person decides whether to publish it. You did not write it. Report only real problems: a rule broken, a fact the claims don't support, a question that leads, blames, names a party or politician, or that some readers can't answer truthfully. Don't report matters of taste. An empty list is the right answer for a good quiz.

The quiz format and rules:
<quizzes-readme>
${readme}
</quizzes-readme>

The rules every question follows:
<question-rules>
${rules}
</question-rules>`;

export async function review(env: Env, md: string, b: Brief): Promise<{ issues: string[]; bias: string; cost: number }> {
  const [readme, rules] = await Promise.all([file(env, 'quizzes/README.md'), file(env, 'questions/QUIZ.md')]);
  const { data, cost } = await ask(env, {
    job: 'review',
    system: REVIEW(readme, rules),
    content: `The verified claims the facts may use:\n${b.claims.map((c) => `[${c.id}] (${c.outlet}) ${c.text}\n    quote: "${c.quote}"`).join('\n')}\n\nThe quiz:\n<quiz>\n${md}\n</quiz>`,
    schema: Review,
    effort: 'high',
  });
  return { issues: data.issues.map((i) => `${i.part} (${i.rule}): ${i.problem} Fix: ${i.fix}`), bias: data.bias, cost };
}
