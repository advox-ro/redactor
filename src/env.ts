// What the Worker is given: its bindings (wrangler.jsonc), and the secret REDACTOR_TOKEN, set with
// `npx wrangler secret put`, which every request must carry (index.ts).
export interface Env {
  DB: D1Database;
  AI: Ai;
  ASSETS: Fetcher;
  REDACTOR_TOKEN?: string;
}
