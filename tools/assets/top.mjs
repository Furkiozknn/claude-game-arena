// Top-down height map of a GLB (rows = z from max at the top to min, cols = x): max y per cell, 0-9.
// Used to find small parts such as pots on a stove.
import { NodeIO } from '@gltf-transform/core';
const doc = await new NodeIO().read(process.argv[2]);
const pts = [];
for (const node of doc.getRoot().listNodes()) { const mesh = node.getMesh(); if (!mesh) continue; const m = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) { const a = p.getAttribute('POSITION'), idx = p.getIndices(); const v = [];
    const P = []; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); P.push([0, 1, 2].map(r => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r])); }
    // sample triangles densely so big flat faces count
    const ix = idx ? idx.getArray() : P.map((_, i) => i);
    for (let t = 0; t < ix.length; t += 3) { const [A, B, C] = [P[ix[t]], P[ix[t + 1]], P[ix[t + 2]]];
      for (let u = 0; u <= 6; u++) for (let w = 0; w <= 6 - u; w++) { const s = u / 6, q = w / 6; pts.push([0, 1, 2].map(k => A[k] + (B[k] - A[k]) * s + (C[k] - A[k]) * q)); } } } }
const mn = [0, 1, 2].map(k => Math.min(...pts.map(p => p[k]))), mx = [0, 1, 2].map(k => Math.max(...pts.map(p => p[k])));
const N = 24, g = Array.from({ length: N }, () => Array(N).fill(-1e9));
for (const p of pts) { const i = Math.min(N - 1, ((p[0] - mn[0]) / (mx[0] - mn[0]) * N) | 0), j = Math.min(N - 1, ((p[2] - mn[2]) / (mx[2] - mn[2]) * N) | 0); g[j][i] = Math.max(g[j][i], p[1]); }
console.log('x', mn[0].toFixed(2), mx[0].toFixed(2), 'y', mn[1].toFixed(2), mx[1].toFixed(2), 'z', mn[2].toFixed(2), mx[2].toFixed(2));
for (let j = N - 1; j >= 0; j--) console.log(g[j].map(z => z < -1e8 ? ' ' : String(Math.min(9, Math.max(0, Math.round((z - mn[1]) / (mx[1] - mn[1]) * 9))))).join(''));
