// Normalises a generated GLB for a game: bakes all node transforms, rotates it, fits it to a target size,
// moves the pivot, optionally drops triangles, then welds, simplifies and compresses the texture to WebP.
// Usage: node fit.mjs <in.glb> <out.glb> '<json options>'
// Options: rot: [[axis, degrees], ...] applied in order (axis 'x'|'y'|'z');
//   size: [x, y, z] target size (null entries follow the uniform scale of `fit` axis); fit: 'x'|'y'|'z' (default: largest given);
//   pivot: 'base' (bottom centre, default) | 'center'; dropHoleR: drop triangles whose centroid is within this fraction of the
//   half-size around the z axis (fills generated inside rings); tex: texture size (default 512); ratio: simplify ratio.
import { NodeIO } from '@gltf-transform/core';
import { weld, simplify, textureCompress, dedup, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [inp, out, json = '{}'] = process.argv.slice(2);
const O = JSON.parse(json);
const io = new NodeIO();
const doc = await io.read(inp);
const root = doc.getRoot();

// 3x3 rotation helpers (column vectors)
const rotM = (ax, deg) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  if (ax === 'x') return [[1, 0, 0], [0, c, -s], [0, s, c]];
  if (ax === 'y') return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
};
const mul = (A, B) => A.map((r, i) => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
let R = O.mat || [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; // O.mat: rows of a 3x3 matrix applied first
for (const [ax, deg] of O.rot || []) R = mul(rotM(ax, deg), R);
const app = (M, v) => [0, 1, 2].map(i => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]);

// bake world matrices + rotation into the positions and normals
const prims = [];
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const W = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL');
    const v = [];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      const w = [0, 1, 2].map(r => W[r] * v[0] + W[4 + r] * v[1] + W[8 + r] * v[2] + W[12 + r]);
      pos.setElement(i, app(R, w));
    }
    if (nor) for (let i = 0; i < nor.getCount(); i++) {
      nor.getElement(i, v);
      const w = [0, 1, 2].map(r => W[r] * v[0] + W[4 + r] * v[1] + W[8 + r] * v[2]);
      const n = app(R, w), l = Math.hypot(...n) || 1;
      nor.setElement(i, n.map(x => x / l));
    }
    prims.push(p);
  }
}
for (const node of root.listNodes()) { node.setTranslation([0, 0, 0]); node.setRotation([0, 0, 0, 1]); node.setScale([1, 1, 1]); }

// bounds
const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (const p of prims) { const a = p.getAttribute('POSITION'), v = []; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } } }
const size = [0, 1, 2].map(k => mx[k] - mn[k]);
const T = O.size || [null, null, null];
const fitAx = O.fit ? 'xyz'.indexOf(O.fit) : [0, 1, 2].filter(k => T[k] != null).sort((a, b) => T[b] - T[a])[0] ?? 1;
const uni = T[fitAx] != null ? T[fitAx] / size[fitAx] : 1;
const sc = [0, 1, 2].map(k => (T[k] != null ? T[k] / size[k] : uni));
const ctr = [(mn[0] + mx[0]) / 2, O.pivot === 'center' ? (mn[1] + mx[1]) / 2 : mn[1], (mn[2] + mx[2]) / 2];
for (const p of prims) {
  const a = p.getAttribute('POSITION'), v = [];
  for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); a.setElement(i, [0, 1, 2].map(k => (v[k] - ctr[k]) * sc[k])); }
  // non-uniform scale: fix normals (inverse-transpose of a diagonal = 1/s)
  const n = p.getAttribute('NORMAL');
  if (n) for (let i = 0; i < n.getCount(); i++) { n.getElement(i, v); const w = [0, 1, 2].map(k => v[k] / sc[k]), l = Math.hypot(...w) || 1; n.setElement(i, w.map(x => x / l)); }
  if (O.dropHoleR) { // remove triangles near the ring axis (z)
    const idx = p.getIndices(), arr = idx.getArray(), keep = [];
    const hx = size[0] * sc[0] / 2, P = (i) => { const q = []; a.getElement(i, q); return q; };
    for (let t = 0; t < arr.length; t += 3) {
      const A = P(arr[t]), B = P(arr[t + 1]), C = P(arr[t + 2]);
      const r = Math.hypot((A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3 - (O.pivot === 'center' ? 0 : size[1] * sc[1] / 2));
      if (r > O.dropHoleR * hx) keep.push(arr[t], arr[t + 1], arr[t + 2]);
    }
    idx.setArray(new Uint32Array(keep));
  }
  if (O.dropBelow) { // remove triangles whose centroid is below this fraction of the height (generated slabs), move down
    const idx = p.getIndices(), arr = idx.getArray(), keep = [], H = size[1] * sc[1], lim = O.dropBelow * H;
    const Y = (i) => { const q = []; a.getElement(i, q); return q[1]; };
    for (let t = 0; t < arr.length; t += 3) if ((Y(arr[t]) + Y(arr[t + 1]) + Y(arr[t + 2])) / 3 > lim) keep.push(arr[t], arr[t + 1], arr[t + 2]);
    idx.setArray(new Uint32Array(keep));
    for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); v[1] -= lim; a.setElement(i, v); }
  }
}
await MeshoptSimplifier.ready;
await doc.transform(
  dedup(), weld(),
  ...(O.ratio ? [simplify({ simplifier: MeshoptSimplifier, ratio: O.ratio, error: 0.01 })] : []),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [O.tex || 512, O.tex || 512], quality: 82 }),
);
await io.write(out, doc);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
const nb = [Infinity, Infinity, Infinity], xb = [-Infinity, -Infinity, -Infinity];
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'), v = []; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); for (let k = 0; k < 3; k++) { nb[k] = Math.min(nb[k], v[k]); xb[k] = Math.max(xb[k], v[k]); } } }
console.log(out, 'tris', tris, 'min', nb.map(v => v.toFixed(2)).join(','), 'max', xb.map(v => v.toFixed(2)).join(','));
