// What the Worker is given: its bindings (wrangler.jsonc), and the secrets set with
// `npx wrangler secret put`: GITHUB_TOKEN to read the site repository (sync.ts), and REDACTOR_TOKEN,
// which every request must carry (index.ts).
export interface Env {
  DB: D1Database;
  AI: Ai;
  SITE_REPO: string;
  GITHUB_TOKEN?: string;
  REDACTOR_TOKEN?: string;
}
