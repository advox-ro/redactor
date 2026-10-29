// Usage: node scripts/await-pr.mjs <pull request number>
// Waits, up to 30 minutes, until the pull request is merged or closed, or until the check job
// posts a new comment saying why it failed. Prints "merged", "closed" or that comment, and exits
// with 0 only when merged. Reads ADVOX_GITHUB_TOKEN. For the editor (EDITOR.md).
const pr = process.argv[2];
const token = process.env.ADVOX_GITHUB_TOKEN;
if (!pr || !token) {
  console.error('usage: ADVOX_GITHUB_TOKEN=… node scripts/await-pr.mjs <number>');
  process.exit(2);
}
const api = (path) =>
  fetch(`https://api.github.com/repos/advox-ro/redactor${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }).then((r) => {
    if (!r.ok) throw new Error(`GitHub ${path}: ${r.status}`);
    return r.json();
  });
const FAILED = 'Verificările nu au trecut';
const failures = async () => (await api(`/issues/${pr}/comments?per_page=100`)).filter((c) => c.body.startsWith(FAILED));

const before = (await failures()).length;
const until = Date.now() + 30 * 60_000;
while (Date.now() < until) {
  const p = await api(`/pulls/${pr}`);
  if (p.merged) {
    console.log('merged');
    process.exit(0);
  }
  if (p.state === 'closed') {
    console.log('closed');
    process.exit(1);
  }
  const now = await failures();
  if (now.length > before) {
    console.log(now.at(-1).body);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 30_000));
}
console.log('still waiting after 30 minutes: the checks may be stuck; look at the pull request');
process.exit(1);
