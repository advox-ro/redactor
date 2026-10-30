// Usage: node scripts/await-pr.mjs <pull request number>
// Waits, up to 30 minutes, until the pull request is merged or closed, or until the check job
// posts a new comment saying why it failed. Prints "merged", "closed" or that comment, and exits
// with 0 only when merged. Asks the redactor (GET /proposals/<n>), with REDACTOR_TOKEN. For the
// editor (EDITOR.md).
const pr = process.argv[2];
const token = process.env.REDACTOR_TOKEN;
if (!pr || !token) {
  console.error('usage: REDACTOR_TOKEN=… node scripts/await-pr.mjs <number>');
  process.exit(2);
}
const status = async () => {
  const r = await fetch(`https://redactor.advox.ro/proposals/${pr}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`redactor /proposals/${pr}: ${r.status} ${await r.text()}`);
  return r.json();
};

const before = (await status()).failures.length;
const until = Date.now() + 30 * 60_000;
while (Date.now() < until) {
  const p = await status();
  if (p.state === 'merged') {
    console.log('merged');
    process.exit(0);
  }
  if (p.state === 'closed') {
    console.log('closed');
    process.exit(1);
  }
  if (p.failures.length > before) {
    console.log(p.failures.at(-1).body);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 30_000));
}
console.log('still waiting after 30 minutes: the checks may be stuck; look at the pull request');
process.exit(1);
