// Slices the Çay Ocağı icon sheet (5x4 grid, 448 px cells) into trimmed 96 px PNGs and makes the logo sizes.
// Usage: node slice-cay.cjs <raw-folder> <repo>/assets/ui
const sharp = require('sharp');
const [raw, out] = process.argv.slice(2);
const names = ['tea', 'simit', 'coffee', 'ayran', 'sink', 'dirty', 'coin', 'happy', 'angry', 'star',
  'person', 'office', 'group', 'regular', 'kettle', 'tray', 'oven', 'apprentice', 'table', 'stool'];
const COLS = 5, CELL = 448;
async function clean(buf) {
  // drop the faint dark glow (alpha < 70 → 0) and specks from neighbouring cells (components < 3% of the largest)
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let p = 3; p < data.length; p += 4) if (data[p] < 70) data[p] = 0;
  const W = info.width, H = info.height, lab = new Int32Array(W * H).fill(-1), sizes = [];
  for (let s0 = 0; s0 < W * H; s0++) {
    if (lab[s0] >= 0 || data[s0 * 4 + 3] === 0) continue;
    const id = sizes.length, st = [s0]; lab[s0] = id; let n = 0;
    while (st.length) {
      const q = st.pop(); n++; const x = q % W, y = (q / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, r = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && lab[r] < 0 && data[r * 4 + 3] > 0) { lab[r] = id; st.push(r); }
      }
    }
    sizes.push(n);
  }
  const big = Math.max(...sizes);
  for (let q = 0; q < W * H; q++) if (lab[q] >= 0 && sizes[lab[q]] < big * 0.03) data[q * 4 + 3] = 0;
  return sharp(data, { raw: info }).png().toBuffer();
}
(async () => {
  const fs = require('fs'); fs.mkdirSync(out + '/icons', { recursive: true });
  for (let i = 0; i < names.length; i++) {
    const buf = await sharp(raw + '/icons.png').extract({ left: (i % COLS) * CELL, top: Math.floor(i / COLS) * CELL, width: CELL, height: CELL }).toBuffer();
    await sharp(await clean(buf)).trim({ threshold: 1 }).resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(`${out}/icons/${names[i]}.png`);
  }
  const logo = await sharp(await clean(await sharp(raw + '/logo.png').toBuffer())).trim({ threshold: 1 }).toBuffer();
  await sharp(logo).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(out + '/logo.png');
  await sharp(logo).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(out + '/favicon.png');
  // contact sheet on the game's cream colour, at real UI sizes (48 and 24 px) to check halos and legibility
  const comps = [];
  for (let i = 0; i < names.length; i++) {
    const p = `${out}/icons/${names[i]}.png`;
    comps.push({ input: await sharp(p).resize(48, 48).toBuffer(), left: i * 56 + 8, top: 8 });
    comps.push({ input: await sharp(p).resize(24, 24).toBuffer(), left: i * 56 + 20, top: 70 });
    comps.push({ input: p, left: (i % 10) * 104 + 8, top: 110 + Math.floor(i / 10) * 104 });
  }
  comps.push({ input: out + '/logo.png', left: 1130, top: 40 });
  await sharp({ create: { width: 1400, height: 330, channels: 4, background: '#f6e7cf' } }).composite(comps).png().toFile(raw + '/contact.png');
})();
