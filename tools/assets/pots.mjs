// Finds raised parts (e.g. pots on a stove) of a GLB after a yaw rotation: clusters the vertices above a height
// fraction and prints each cluster's centre. Usage: node pots.mjs file.glb [yaw-radians] [min-height-fraction]
import { NodeIO } from '@gltf-transform/core';
const [f, yaw = 0, fr = .4] = process.argv.slice(2);
const c = Math.cos(+yaw), s = Math.sin(+yaw);
const doc = await new NodeIO().read(f);
const pts = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const m = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) {
    const a = p.getAttribute('POSITION'), v = [];
    for (let i = 0; i < a.getCount(); i++) {
      a.getElement(i, v);
      const w = [0, 1, 2].map(r => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]);
      pts.push([w[0] * c + w[2] * s, w[1], -w[0] * s + w[2] * c]); // same rotation as THREE geometry.rotateY(yaw)
    }
  }
}
const range = k => [Math.min(...pts.map(p => p[k])), Math.max(...pts.map(p => p[k]))];
const H = range(1)[1];
console.log('H', H.toFixed(3), 'x', range(0).map(v => v.toFixed(3)).join(' '), 'z', range(2).map(v => v.toFixed(3)).join(' '));
const cl = [];
for (const p of pts.filter(p => p[1] > H * fr)) {
  let k = cl.find(q => Math.hypot(q.x / q.n - p[0], q.z / q.n - p[2]) < .12);
  if (!k) cl.push(k = { x: 0, z: 0, y: 0, n: 0, top: 0 });
  k.x += p[0]; k.z += p[2]; k.y += p[1]; k.n++; k.top = Math.max(k.top, p[1]);
}
for (const k of cl.filter(k => k.n > 4)) console.log('x', (k.x / k.n).toFixed(3), 'z', (k.z / k.n).toFixed(3), 'meanY', (k.y / k.n).toFixed(3), 'top', k.top.toFixed(3), 'n', k.n);
