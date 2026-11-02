// The wiki's Markdown may hold text, formatting and links, nothing the browser would run: the site
// puts its HTML in the page as it is. Raw HTML, and links or images to anything but a web address,
// a path on the site or an anchor, stop the build, so a pull request carrying them fails its checks.
import { defineMdastPlugin } from 'satteri';

const SAFE_URL = /^(https?:\/\/|\/(?!\/)|#)/i;

export default defineMdastPlugin({
  name: 'wiki-safe-markdown',

  before(root) {
    const bad = [];
    const walk = (n) => {
      if (n.type === 'html') bad.push(`raw HTML: ${n.value.trim().slice(0, 60)}`);
      if (['link', 'image', 'definition'].includes(n.type) && !SAFE_URL.test(n.url ?? '')) bad.push(`${n.type} to "${n.url}"`);
      for (const c of n.children ?? []) walk(c);
    };
    walk(root);
    if (bad.length) throw new Error(`not allowed in the wiki: ${bad.join('; ')}`);
  },
});
