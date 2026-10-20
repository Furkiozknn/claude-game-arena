// Prints a top-down occupancy map of a GLB's vertices above a height fraction (to locate parts like pots).
import { NodeIO } from '@gltf-transform/core';
const doc = await new NodeIO().read(process.argv[2]); const frac = +(process.argv[3] || 0.5);
const pts = [];
for (const node of doc.getRoot().listNodes()) { const mesh = node.getMesh(); if (!mesh) continue; const m = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) { const a = p.getAttribute('POSITION'); const v = [];
    for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); pts.push([0, 1, 2].map(r => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r])); } } }
const mn = [0, 1, 2].map(k => Math.min(...pts.map(p => p[k]))), mx = [0, 1, 2].map(k => Math.max(...pts.map(p => p[k])));
console.log('min', mn.map(v => v.toFixed(3)).join(','), 'max', mx.map(v => v.toFixed(3)).join(','));
const N = 20, grid = Array.from({ length: N }, () => Array(N).fill(0));
for (const p of pts) if ((p[1] - mn[1]) / (mx[1] - mn[1]) > frac) { const i = Math.min(N - 1, ((p[0] - mn[0]) / (mx[0] - mn[0]) * N) | 0), j = Math.min(N - 1, ((p[2] - mn[2]) / (mx[2] - mn[2]) * N) | 0); grid[j][i]++; }
console.log('rows = z from min to max, cols = x from min to max');
for (const r of grid) console.log(r.map(c => c ? (c > 9 ? '#' : c) : '.').join(''));
