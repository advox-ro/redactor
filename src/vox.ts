// Vox: the language model that reads the news and writes the drafts. Every call's cost is kept in
// the runs table and checked against the day's cap (DAILY_BUDGET_USD) first: over the cap, the call
// is not made.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Env } from './env';

export const MODEL = 'claude-opus-5-5';
const PRICE = { input: 4 / 1e6, output: 20 / 1e6, cacheRead: 0.2 / 1e6, cacheWrite: 5 / 1e6 };

export class OverBudget extends Error {}

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>;
  return rest;
}

const dayStart = () => Date.now() - (Date.now() % 86_400_000);

export async function spentToday(env: Env): Promise<number> {
  const r = await env.DB.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS s FROM runs WHERE started_at >= ?').bind(dayStart()).first<{ s: number }>();
  return r?.s ?? 0;
}

type Ask<T extends z.ZodType> = {
  job: string;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[] | string;
  schema: T;
  effort?: 'low' | 'medium' | 'high' | 'xhigh';
  maxTokens?: number;
};

/** One call that must answer with JSON matching `schema`. Returns the parsed answer and its cost. */
export async function ask<T extends z.ZodType>(env: Env, a: Ask<T>): Promise<{ data: z.infer<T>; cost: number }> {
  if (!env.VOX_API_KEY) throw new Error('VOX_API_KEY is not set');
  if ((await spentToday(env)) >= Number(env.DAILY_BUDGET_USD)) throw new OverBudget(`the day's budget of $${env.DAILY_BUDGET_USD} is spent`);
  const client = new Anthropic({ apiKey: env.VOX_API_KEY });
  const started = Date.now();
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: a.maxTokens ?? 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // The instructions are the same on every call of a job: cached.
    system: [{ type: 'text', text: a.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: a.content }],
    output_config: { effort: a.effort ?? 'medium', format: { type: 'json_schema', schema: jsonSchema(a.schema) } },
  } as Anthropic.Beta.MessageCreateParamsNonStreaming);
  const u = res.usage;
  const cost =
    (u.input_tokens ?? 0) * PRICE.input +
    (u.output_tokens ?? 0) * PRICE.output +
    (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
    (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite;
  await env.DB.prepare('INSERT INTO runs (job, started_at, finished_at, status, detail, cost_usd) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(`vox:${a.job}`, started, Date.now(), res.stop_reason ?? 'unknown', `${u.input_tokens} in, ${u.output_tokens} out`, cost)
    .run();
  if (res.stop_reason === 'refusal') throw new Error(`Vox declined (${a.job})`);
  if (res.stop_reason === 'max_tokens') throw new Error(`the answer was cut off (${a.job})`);
  const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return { data: a.schema.parse(JSON.parse(text)), cost };
}
