// Embeddings as float32 blobs in D1, and the cosine between them. bge-m3 vectors come normalised,
// so the cosine is the dot product; centroids are normalised again after every update.
export type Vec = Float32Array;

export const toBlob = (v: Vec): ArrayBuffer => v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) as ArrayBuffer;
export const fromBlob = (b: ArrayBuffer | Uint8Array | number[]): Vec =>
  b instanceof ArrayBuffer ? new Float32Array(b) : Array.isArray(b) ? new Float32Array(new Uint8Array(b).buffer) : new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));

export function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function normalize(v: Vec): Vec {
  const n = Math.sqrt(dot(v, v)) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

/** The centroid after adding v to a story that had n articles: the running mean, normalised. */
export function addToMean(mean: Vec, n: number, v: Vec): Vec {
  const out = new Float32Array(mean.length);
  for (let i = 0; i < mean.length; i++) out[i] = (mean[i] * n + v[i]) / (n + 1);
  return normalize(out);
}
