// PWA アイコン生成（外部ライブラリ不使用・zlib のみ）。
// 黒い地に、細い灰色の輪と、その一部だけ白い弧（進み具合の円）。
// ⚠ 色を入れない（灰色だけ）。PNGエンコード部は kundalini/scripts/gen-icons.mjs と同じ手法。

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function draw(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const radius = maskable ? 0 : size * 0.22;
  const ringR = size * (maskable ? 0.26 : 0.32);
  const ringW = Math.max(2, size * 0.035);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let v = 0;
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - ringR) <= ringW / 2) {
        // 右上から時計回りに 7 割ぶんを白、残りを灰色に
        const ang = (Math.atan2(y - cy, x - cx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
        v = ang <= Math.PI * 2 * 0.7 ? 0xff : 0x2a;
      }
      if (!maskable && radius > 0) {
        const nx = Math.min(x, size - 1 - x);
        const ny = Math.min(y, size - 1 - y);
        if (nx < radius && ny < radius && Math.hypot(radius - nx, radius - ny) > radius) {
          rgba[i + 3] = 0;
          continue;
        }
      }
      rgba[i] = v;
      rgba[i + 1] = v;
      rgba[i + 2] = v;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-180.png', 180, false],
  ['icon-maskable-512.png', 512, true],
]) {
  writeFileSync(join(OUT_DIR, name), encodePng(size, size, draw(size, maskable)));
  console.log('wrote', name, `${size}x${size}`);
}
