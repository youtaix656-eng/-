// 大きな符号化文字列を、QRコード・コピペテキスト・WebRTCシグナリングで
// 分割して送るための共通プロトコル。
//
// 1チャンクの形式（URL/テキストどちらにも埋め込める区切り文字 '.' を使用。
// data 部分は base64url なので '.' は含まれない）：
//   {transferId}.{part}.{of}.{data}
//
// 受信側は Reassembler で複数チャンクを順不同に集め、揃ったら結合して返す。

function randomId(len = 5) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// 符号化済み文字列 → チャンク配列（各要素は 上記形式の文字列）
export function splitIntoChunks(encoded, chunkSize) {
  const transferId = randomId();
  const total = Math.max(1, Math.ceil(encoded.length / chunkSize));
  const parts = [];
  for (let i = 0; i < total; i++) {
    const data = encoded.slice(i * chunkSize, (i + 1) * chunkSize);
    parts.push(`${transferId}.${i + 1}.${total}.${data}`);
  }
  return { transferId, parts };
}

// チャンク文字列 → {transferId, part, of, data} / 形式が違えば null
export function parseChunk(text) {
  if (!text) return null;
  const m = String(text).trim().match(/^([a-z0-9]{3,12})\.(\d+)\.(\d+)\.([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  const part = Number(m[2]);
  const of = Number(m[3]);
  if (!(part >= 1 && of >= 1 && part <= of)) return null;
  return { transferId: m[1], part, of, data: m[4] };
}

// 複数チャンクを集めて元の符号化文字列に組み立てる。
// 順不同・重複投入OK。transferId が異なるチャンクが来たら新しい転送として集め直す
// （古い転送の断片は破棄）。
export class Reassembler {
  constructor() {
    this.transferId = null;
    this.of = 0;
    this.parts = new Map(); // part(number) -> data
  }

  // チャンク文字列を1つ追加。戻り値: { ok, isNewTransfer, receivedCount, total, complete }
  add(text) {
    const chunk = parseChunk(text);
    if (!chunk) return { ok: false, isNewTransfer: false, receivedCount: this.parts.size, total: this.of, complete: false };
    let isNewTransfer = false;
    if (this.transferId !== chunk.transferId) {
      this.transferId = chunk.transferId;
      this.of = chunk.of;
      this.parts = new Map();
      isNewTransfer = true;
    }
    this.parts.set(chunk.part, chunk.data);
    return {
      ok: true,
      isNewTransfer,
      receivedCount: this.parts.size,
      total: this.of,
      complete: this.parts.size === this.of,
    };
  }

  get receivedParts() {
    return Array.from(this.parts.keys()).sort((a, b) => a - b);
  }

  get missingParts() {
    const missing = [];
    for (let i = 1; i <= this.of; i++) if (!this.parts.has(i)) missing.push(i);
    return missing;
  }

  // 揃っていれば結合した符号化文字列を返す。揃っていなければ null。
  assemble() {
    if (this.of === 0 || this.parts.size !== this.of) return null;
    let out = '';
    for (let i = 1; i <= this.of; i++) out += this.parts.get(i);
    return out;
  }

  reset() {
    this.transferId = null;
    this.of = 0;
    this.parts = new Map();
  }
}
