// PWA アイコン生成（外部ライブラリ不使用・zlib のみ）。
// 夜（ink）の地に、地平線から昇る朝焼け（dawn）の円を描く＝このアプリの主題そのもの。
// PNGエンコード部は sleep-tracker/scripts/gen-icons.mjs と同じ手法。

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public');

const INK = [0x10, 0x14, 0x2b, 255];
const INDIGO = [0x3e, 0x3a, 0x73, 255];
const DAWN = [0xe8, 0xa3, 0x3d, 255];
const EMBER = [0xd9, 0x64, 0x3a, 255];

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

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255,
  ];
}

/**
 * @param {number} size
 * @param {boolean} maskable セーフゾーン（中央80%）に収める版か
 */
function draw(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const inset = maskable ? size * 0.1 : 0;
  const box = size - inset * 2;
  const cx = size / 2;
  // 地平線と太陽の位置（正方形の下寄りに置くと「昇る」に見える）
  const horizon = inset + box * 0.68;
  const sunY = horizon - box * 0.06;
  const sunR = box * 0.2;
  const radius = maskable ? 0 : size * 0.22; // 角丸（maskable は OS 側が丸める）

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let color = INK;

      // 空：上から下へ 夜 → 藍 → 朝焼けへ寄せる
      const t = Math.max(0, Math.min(1, (y - inset) / box));
      color = mix(INK, INDIGO, Math.min(1, t * 1.15));
      if (y > horizon) {
        // 地面は暗く沈める
        color = mix(INK, INDIGO, 0.25);
      } else {
        const glow = Math.max(0, 1 - Math.hypot(x - cx, y - sunY) / (sunR * 2.6));
        color = mix(color, EMBER, glow * 0.55);
      }

      // 太陽（地平線から上だけを描く＝昇りかけ）
      const dr = Math.hypot(x - cx, y - sunY);
      if (dr <= sunR && y <= horizon) color = DAWN;

      // 地平線の細い線
      if (Math.abs(y - horizon) < Math.max(1, size * 0.006)) color = mix(color, DAWN, 0.5);

      // 角丸の外側は透明に
      if (!maskable && radius > 0) {
        const nx = Math.min(x, size - 1 - x);
        const ny = Math.min(y, size - 1 - y);
        if (nx < radius && ny < radius && Math.hypot(radius - nx, radius - ny) > radius) {
          rgba[i + 3] = 0;
          continue;
        }
      }
      // maskable のセーフゾーン外は背景色で埋める
      if (maskable && (x < inset || x > size - inset || y < inset || y > size - inset)) color = INK;

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
