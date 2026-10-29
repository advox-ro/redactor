// What the Worker is given: its bindings (wrangler.jsonc), and the secrets set with
// `npx wrangler secret put`: VOX_API_KEY for Vox (src/vox.ts), GITHUB_TOKEN to read the site
// repository and open pull requests on it, SYNC_TOKEN for the /sync call from the repositories'
// deploy jobs.
export interface Env {
  DB: D1Database;
  AI: Ai;
  SITE_REPO: string;
  DAILY_BUDGET_USD: string;
  VOX_API_KEY?: string;
  GITHUB_TOKEN?: string;
  SYNC_TOKEN?: string;
}
