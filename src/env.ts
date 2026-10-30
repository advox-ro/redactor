// What the Worker is given: its bindings (wrangler.jsonc), and two secrets set with
// `npx wrangler secret put`: REDACTOR_TOKEN, which every request must carry (index.ts), and
// GITHUB_TOKEN, with which it opens the editor's pull requests as advox-ro (proposals.ts).
export interface Env {
  DB: D1Database;
  AI: Ai;
  ASSETS: Fetcher;
  REDACTOR_TOKEN?: string;
  GITHUB_TOKEN?: string;
}
