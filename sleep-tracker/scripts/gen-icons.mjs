// PWA アイコン生成スクリプト（外部画像ライブラリ不使用・zlib のみ）。
// 深紺の背景に三日月（アンバー）を描いた単色図形を、必要サイズぶん出力する。

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'icons');

const BG = [10, 14, 24, 255]; // #0a0e18
const AMBER = [242, 177, 56, 255]; // #f2b138

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

// ---------------- 図形描画 ----------------

function insideRoundedRect(x, y, w, h, r) {
  const cx = Math.min(Math.max(x, r), w - r);
  const cy = Math.min(Math.max(y, r), h - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function insideCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function setPixel(rgba, width, x, y, color) {
  const i = (y * width + x) * 4;
  rgba[i] = color[0];
  rgba[i + 1] = color[1];
  rgba[i + 2] = color[2];
  rgba[i + 3] = color[3];
}

// mode: 'standard' (角丸・透過背景) | 'maskable' (フルブリード・不透明) | 'apple' (正方形・不透明)
function renderIcon(size, mode) {
  const rgba = Buffer.alloc(size * size * 4);
  const cornerRadius = mode === 'standard' ? size * 0.22 : 0;
  const opaqueSquare = mode !== 'standard';

  // 三日月のサイズ・位置（maskable はセーフゾーン内に収める）
  const moonScale = mode === 'maskable' ? 0.22 : 0.3;
  const eraseScale = mode === 'maskable' ? 0.17 : 0.235;
  const cx = size * 0.52;
  const cy = size * 0.48;
  const r1 = size * moonScale;
  const r2 = size * eraseScale;
  const ex = cx + size * (mode === 'maskable' ? 0.09 : 0.11);
  const ey = cy - size * (mode === 'maskable' ? 0.06 : 0.08);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inBg = opaqueSquare || insideRoundedRect(x, y, size, size, cornerRadius);
      if (!inBg) {
        setPixel(rgba, size, x, y, [0, 0, 0, 0]);
        continue;
      }
      const inMoon = insideCircle(x, y, cx, cy, r1) && !insideCircle(x, y, ex, ey, r2);
      setPixel(rgba, size, x, y, inMoon ? AMBER : BG);
    }
  }
  return rgba;
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, mode: 'standard' },
  { file: 'icon-512.png', size: 512, mode: 'standard' },
  { file: 'maskable-512.png', size: 512, mode: 'maskable' },
  { file: 'apple-touch-icon.png', size: 180, mode: 'apple' },
];

for (const t of targets) {
  const rgba = renderIcon(t.size, t.mode);
  const png = encodePng(t.size, t.size, rgba);
  writeFileSync(join(OUT_DIR, t.file), png);
  console.log(`generated ${t.file} (${t.size}x${t.size})`);
}
