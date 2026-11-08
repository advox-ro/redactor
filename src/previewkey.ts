// The key of a draft's address on the site. Only the redactor makes it, for its own headless browser
// (preview.ts), so a visitor can't open a draft or make the redactor read GitHub.
const encoder = new TextEncoder();

const secretKey = (secret: string) =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

/** The key of a branch's draft, in hex. */
export async function previewKey(secret: string, branch: string): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', await secretKey(secret), encoder.encode(branch));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Whether `key` is the key of this branch's draft. */
export async function validPreviewKey(secret: string | undefined, branch: string, key: string): Promise<boolean> {
  if (!secret || !/^[0-9a-f]{64}$/.test(key)) return false;
  const mac = Uint8Array.from(key.match(/../g)!, (h) => parseInt(h, 16));
  return crypto.subtle.verify('HMAC', await secretKey(secret), mac, encoder.encode(branch));
}
