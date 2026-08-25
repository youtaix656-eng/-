// 情報の取り込み（Web / YouTube / PDF / メモ / 音声メモ）。
//
// ブラウザだけで完結させるため、クロスオリジンの本文取得はしない。
// 代わりに「URL＋本文の貼り付け」を基本とし、Claude 接続時だけ
// 社員が自分で検索・取得できる（providers/anthropic.js の serverTools）。

import { makeSource, createKnowledge } from './knowledge.js';

export const INGEST_KINDS = [
  { id: 'web', name: 'Webページ', glyph: '⌕', needsUrl: true, hint: 'URL と、読み取った本文（任意）' },
  { id: 'youtube', name: 'YouTube', glyph: '▷', needsUrl: true, hint: 'URL と、文字起こし（任意）' },
  { id: 'pdf', name: 'PDF', glyph: '▤', needsUrl: false, hint: 'ファイルを選ぶか、本文を貼る' },
  { id: 'note', name: 'メモ', glyph: '✍', needsUrl: false, hint: '自分の言葉で書く' },
  { id: 'audio', name: '音声メモ', glyph: '◍', needsUrl: false, hint: '文字起こしを貼る' },
];

export function detectKind(url = '') {
  const u = String(url);
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/\.pdf($|\?)/i.test(u)) return 'pdf';
  if (/^https?:\/\//.test(u)) return 'web';
  return 'note';
}

export function youtubeId(url = '') {
  const m =
    String(url).match(/[?&]v=([\w-]{6,})/) ||
    String(url).match(/youtu\.be\/([\w-]{6,})/) ||
    String(url).match(/\/shorts\/([\w-]{6,})/);
  return m ? m[1] : null;
}

/**
 * 取り込み1件を「出典 + 知識」に変える。
 * origin は必ず 'external'（外部由来）か 'user'（自分で書いた）になる。
 * AI が触っていない生の取り込みを 'ai' にしない。
 */
export function ingestOne({ kind = 'note', url = '', title = '', text = '', tags = [], category = 'メモ' }) {
  const k = kind || detectKind(url);
  const source = makeSource({
    type: k,
    title: title || url || '取り込み',
    url,
    excerpt: text,
    addedBy: 'user',
    trust: k === 'note' ? 60 : 50,
  });

  const { knowledge } = createKnowledge({
    title: title || url || '取り込んだ情報',
    summary: firstSentences(text, 200),
    body: text,
    category,
    tags,
    origin: k === 'note' || k === 'audio' ? 'user' : 'external',
    sourceIds: [source.id],
    trust: k === 'note' ? 60 : 50,
  });

  return { source, knowledge };
}

function firstSentences(text = '', limit = 200) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

/** PDF をそのままエンジンへ渡せるか（今は Claude だけ）。 */
export function canReadFile(provider) {
  return Boolean(provider && provider.supportsPdf);
}

/** File → base64（PDF を Claude へ渡すため）。 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
