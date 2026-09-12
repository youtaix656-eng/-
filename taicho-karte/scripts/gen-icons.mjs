// PWA アイコン生成（外部ライブラリ不使用・zlib のみ）。
// 暗い地に、人の形（頭＋胴）と、部位を示す1つの点を描く。
// PNGエンコード部は kundalini/scripts/gen-icons.mjs と同じ手法。

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public');

const BG = [0x0b, 0x0d, 0x10];
const BODY = [0xe8, 0xea, 0xee];
const DOT = [0xd9, 0x82, 0x2b];

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
  const radius = maskable ? 0 : size * 0.22;
  const cx = size / 2;
  const headR = size * 0.11;
  const headY = size * 0.32;
  const bodyX0 = cx - size * 0.13;
  const bodyX1 = cx + size * 0.13;
  const bodyY0 = size * 0.46;
  const bodyY1 = size * 0.78;
  const bodyRound = size * 0.09;
  const dotR = size * 0.085;
  const dotX = cx + size * 0.2;
  const dotY = size * 0.62;

  const inRoundRect = (x, y) => {
    if (x < bodyX0 || x > bodyX1 || y < bodyY0 || y > bodyY1) return false;
    const nx = Math.min(x - bodyX0, bodyX1 - x);
    const ny = Math.min(y - bodyY0, bodyY1 - y);
    if (nx < bodyRound && ny < bodyRound) return Math.hypot(bodyRound - nx, bodyRound - ny) <= bodyRound;
    return true;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let color = BG;
      if (Math.hypot(x - cx, y - headY) <= headR || inRoundRect(x, y)) color = BODY;
      if (Math.hypot(x - dotX, y - dotY) <= dotR) color = DOT;
      if (!maskable && radius > 0) {
        const nx = Math.min(x, size - 1 - x);
        const ny = Math.min(y, size - 1 - y);
        if (nx < radius && ny < radius && Math.hypot(radius - nx, radius - ny) > radius) {
          rgba[i + 3] = 0;
          continue;
        }
      }
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
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
