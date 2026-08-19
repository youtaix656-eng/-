// 端末間転送（QR・共有・クラウド・WebRTC）で共通して使う、圧縮＋効率的な符号化。
//
// 旧方式（encodeURIComponent → btoa）は、日本語などマルチバイト文字を
// %E3%81%82 のようなパーセントエンコードに展開してから base64 化するため、
// 3バイトの文字が base64 化前に9文字へ膨張し、さらに base64 で4/3倍になる
// （実質1文字が最大12文字に膨張する二重の無駄）。
//
// 新方式は TextEncoder で直接UTF-8バイト列を取り出し、対応ブラウザでは
// CompressionStream（ブラウザ標準・追加ライブラリ不要）で圧縮してから
// base64url化する。非対応ブラウザ（古いSafari等）では圧縮なしのUTF-8直接
// base64url化にフォールバックする（それでも旧方式より無駄がない）。

const hasCompression = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

function bytesToBase64Url(bytes) {
  // 大きな配列を一度に String.fromCharCode(...bytes) すると引数上限に当たるためチャンク分割
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function readAllChunks(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

async function compressBytes(bytes) {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return readAllChunks(cs.readable);
}

async function decompressBytes(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return readAllChunks(ds.readable);
}

// 文字列 → 符号化文字列（先頭1文字がフォーマット識別子：'1'=圧縮あり／'0'=圧縮なし）
export async function encodeTransferString(text) {
  const bytes = new TextEncoder().encode(text);
  if (hasCompression) {
    try {
      const compressed = await compressBytes(bytes);
      // 圧縮した方が小さい場合だけ圧縮版を使う（短い文字列は圧縮で逆に増えることがある）
      if (compressed.length < bytes.length) {
        return '1' + bytesToBase64Url(compressed);
      }
    } catch (e) { /* 圧縮に失敗したら非圧縮にフォールバック */ }
  }
  return '0' + bytesToBase64Url(bytes);
}

// 符号化文字列 → 元の文字列
export async function decodeTransferString(encoded) {
  if (!encoded || encoded.length < 1) throw new Error('空のデータです');
  const flag = encoded[0];
  const bytes = base64UrlToBytes(encoded.slice(1));
  if (flag === '1') {
    if (!hasCompression) throw new Error('この端末は圧縮データの展開に対応していません');
    const raw = await decompressBytes(bytes);
    return new TextDecoder().decode(raw);
  }
  return new TextDecoder().decode(bytes);
}

export const transferCodecSupportsCompression = hasCompression;
