// Slices the Hisar icon sheet (4x4 grid) into trimmed 96 px PNGs and makes the logo sizes.
const sharp = require('sharp');
const [raw, out] = process.argv.slice(2);
const names = ['gold', 'lives', 'wave', 'archer', 'cannon', 'tar', 'raider', 'rider', 'shield', 'ram', 'upgrade', 'target', 'trophy', 'sound-on', 'sound-off', 'fortress'];
(async () => {
  const cell = 512;
  for (let i = 0; i < 16; i++) {
    const buf = await sharp(raw + '/icons.png').extract({ left: (i % 4) * cell, top: Math.floor(i / 4) * cell, width: cell, height: cell }).toBuffer();
    // drop the faint dark glow: alpha below 110 becomes fully transparent, then trim
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    for (let p = 3; p < data.length; p += 4) if (data[p] < 70) data[p] = 0;
    // remove small specks (pieces of neighbouring cells): keep components over 3% of the largest
    const W = info.width, H = info.height, lab = new Int32Array(W * H).fill(-1), sizes = [];
    for (let s0 = 0; s0 < W * H; s0++) {
      if (lab[s0] >= 0 || data[s0 * 4 + 3] === 0) continue;
      const id = sizes.length, st = [s0]; lab[s0] = id; let n = 0;
      while (st.length) { const q = st.pop(); n++; const x = q % W, y = (q / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, r = ny * W + nx;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && lab[r] < 0 && data[r * 4 + 3] > 0) { lab[r] = id; st.push(r); } } }
      sizes.push(n);
    }
    const big = Math.max(...sizes);
    for (let q = 0; q < W * H; q++) if (lab[q] >= 0 && sizes[lab[q]] < big * 0.03) data[q * 4 + 3] = 0;
    const clean = await sharp(data, { raw: info }).png().toBuffer();
    await sharp(clean).trim({ threshold: 1 }).resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(`${out}/icons/${names[i]}.png`);
  }
  const logo = await sharp(raw + '/logo.png').trim({ threshold: 1 }).toBuffer();
  await sharp(logo).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(out + '/logo.png');
  await sharp(logo).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(out + '/favicon.png');
  // contact sheet on the game's cream colour to check halos
  const comps = names.map((n, i) => ({ input: `${out}/icons/${n}.png`, left: (i % 8) * 110 + 7, top: Math.floor(i / 8) * 110 + 7 }));
  comps.push({ input: out + '/logo.png', left: 890, top: 0 });
  await sharp({ create: { width: 1150, height: 260, channels: 4, background: '#f6e7cf' } }).composite(comps).png().toFile(raw + '/contact.png');
})();
