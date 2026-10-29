// Embeddings from Workers AI: bge-m3, multilingual, so Romanian headlines group well.
import { normalize, type Vec } from './vec';

const MODEL = '@cf/baai/bge-m3';
const BATCH = 50;

export async function embed(ai: Ai, texts: string[]): Promise<Vec[]> {
  const out: Vec[] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const res = (await ai.run(MODEL, { text: texts.slice(i, i + BATCH).map((t) => t.slice(0, 2000)) })) as { data: number[][] };
    for (const d of res.data) out.push(normalize(Float32Array.from(d)));
  }
  return out;
}
