// PWA アイコン生成（外部ライブラリ不使用・zlib のみ）。
// 黒い地に、7つの点を縦に並べる（下＝レベル1、上＝レベル7）。
// ⚠ 背景は黒で統一（アプリ本体と同じ）。人物・性的な連想をさせる形は描かない
//    （ホーム画面に並ぶので、何のアプリか一目で分からない見た目にしておく）。
// PNGエンコード部は henkaku-note/scripts/gen-icons.mjs と同じ手法。

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public');

const BG = [0x00, 0x00, 0x00, 255];
const LINE = [0x2a, 0x2a, 0x33, 255];
// 下（レベル1）から上（レベル7）へ。data/chakras.js の color と同じ並び
const DOTS = [
  [0xc0, 0x39, 0x2b],
  [0xd3, 0x54, 0x00],
  [0xd4, 0xa0, 0x17],
  [0x2e, 0x8b, 0x57],
  [0x29, 0x80, 0xb9],
  [0x4b, 0x3f, 0x9e],
  [0x7d, 0x3c, 0x98],
];

// ---------------- PNG エンコード（IHDR/IDAT/IEND を手組み） ----------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}


// ---------------- 描画 ----------------

/**
 * @param {number} size
 * @param {boolean} maskable セーフゾーン（中央80%）に収める版か
 */
function draw(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const inset = maskable ? size * 0.14 : size * 0.16;
  const box = size - inset * 2;
  const cx = size / 2;
  const radius = maskable ? 0 : size * 0.22; // 角丸（maskable は OS 側が丸める）
  const dotR = box * 0.062;
  const gap = box / (DOTS.length - 1 + 0.6);
  const top = inset + box * 0.05;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let color = BG;

      // 中心を通る細い縦線（7つの点をつなぐ軸）
      if (Math.abs(x - cx) < Math.max(1, size * 0.006) && y > top && y < top + gap * (DOTS.length - 1)) {
        color = LINE;
      }

      // 7つの点（上から順に レベル7 → レベル1）
      for (let d = 0; d < DOTS.length; d++) {
        const cy = top + gap * d;
        if (Math.hypot(x - cx, y - cy) <= dotR) {
          const c = DOTS[DOTS.length - 1 - d];
          color = [c[0], c[1], c[2], 255];
          break;
        }
      }

      // 角丸の外側は透明に
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
const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-180.png', 180, false],
  ['icon-maskable-512.png', 512, true],
];
for (const [name, size, maskable] of targets) {
  writeFileSync(join(OUT_DIR, name), encodePng(size, size, draw(size, maskable)));
  console.log('wrote', name, `${size}x${size}`);
}
