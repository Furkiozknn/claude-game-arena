// Prints the radial profile (max/median radius per height band, in units of total height) of a GLB,
// with node transforms applied. Used to find platform heights of tower models.
import { NodeIO } from '@gltf-transform/core';
const io = new NodeIO();
const doc = await io.read(process.argv[2]);
const pts = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const m = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) {
    const a = p.getAttribute('POSITION'); const v = [];
    for (let i = 0; i < a.getCount(); i++) {
      a.getElement(i, v);
      pts.push([0, 1, 2].map(r => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]));
    }
  }
}
const lo = pts.map(p => p[1]).reduce((a, b) => Math.min(a, b)), hi = pts.map(p => p[1]).reduce((a, b) => Math.max(a, b));
const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
const H = hi - lo, bands = +(process.argv[3] || 25);
console.log('height', H.toFixed(3), 'x', Math.min(...pts.map(p => p[0])).toFixed(3), Math.max(...pts.map(p => p[0])).toFixed(3), 'z', Math.min(...pts.map(p => p[2])).toFixed(3), Math.max(...pts.map(p => p[2])).toFixed(3));
for (let b = 0; b < bands; b++) {
  const y0 = lo + H * b / bands, y1 = lo + H * (b + 1) / bands;
  const r = pts.filter(p => p[1] >= y0 && p[1] < y1).map(p => Math.hypot(p[0] - cx, p[2] - cz) / H).sort((a, b) => a - b);
  console.log((b / bands).toFixed(2), 'n', String(r.length).padStart(4), 'max', (r.at(-1) || 0).toFixed(3), 'med', (r[r.length >> 1] || 0).toFixed(3));
}
