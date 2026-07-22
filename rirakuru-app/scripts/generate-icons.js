// ============================================================
// PWA 用アイコン（PNG）を外部依存なしで生成するスクリプト。
// 実行: node scripts/generate-icons.js
// リラクゼーション寄りの配色で、丸みのある「石」モチーフを描く。
// ============================================================
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function hex(h) {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

const BG = hex("#6f4e37"); // cocoa-600
const STONE1 = hex("#e7dccb"); // cream
const STONE2 = hex("#c4ac86"); // sand-300

// 角丸の内側か判定
function insideRoundedRect(x, y, size, radius) {
  const r = radius;
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function makePng(size) {
  const data = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  // 3つの丸い石を少しずらして配置
  const stones = [
    { x: cx, y: size * 0.42, r: size * 0.26, c: STONE1 },
    { x: size * 0.38, y: size * 0.64, r: size * 0.16, c: STONE2 },
    { x: size * 0.64, y: size * 0.66, r: size * 0.13, c: STONE1 },
  ];
  const radius = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!insideRoundedRect(x, y, size, radius)) {
        data[i + 3] = 0; // 角の外は透明
        continue;
      }
      let [r, g, b] = BG;
      for (const s of stones) {
        const dx = x - s.x;
        const dy = y - s.y;
        if (dx * dx + dy * dy <= s.r * s.r) {
          [r, g, b] = s.c;
        }
      }
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  // フィルタバイト（0）を各行の先頭に付ける
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const idat = zlib.deflateSync(raw);

  function chunk(type, body) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, body])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, body, crc]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// CRC32（PNG 用）
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), makePng(size));
  console.log(`wrote icon-${size}.png`);
}
