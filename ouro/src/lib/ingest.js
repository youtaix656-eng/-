// 情報の取り込み（Web / YouTube / PDF / メモ / 音声メモ）。
//
// ブラウザだけで完結させるため、クロスオリジンの本文取得はしない。
// 代わりに「URL＋本文の貼り付け」を基本とし、Claude 接続時だけ
// 社員が自分で検索・取得できる（providers/anthropic.js の serverTools）。

import { makeSource, createKnowledge } from './knowledge.js';

export const INGEST_KINDS = [
  { id: 'web', name: 'Webページ', glyph: '⌕', needsUrl: true, hint: 'URL と、読み取った本文（任意）' },
  { id: 'youtube', name: 'YouTube', glyph: '▷', needsUrl: true, hint: 'URL と、文字起こし（任意）' },
  // PDF の中身はブラウザだけでは取り出せない。読めるふりをしない。
  { id: 'pdf', name: 'PDF', glyph: '▤', needsUrl: false, hint: '本文をコピーして貼る（PDFの自動読み取りは未対応）' },
  { id: 'note', name: 'メモ', glyph: '✍', needsUrl: false, hint: '自分の言葉で書く' },
  { id: 'audio', name: '音声メモ', glyph: '◍', needsUrl: false, hint: '文字起こしを貼る' },
  // APIキーが無いとき、Claude などの会話で書かせたものを貼る口（docs/PROMPT.md）。
  // **メモと同じ扱いにしない。** メモは来歴 'user'（自分で書いた）になるので、
  // AIに書かせたものを貼ると「誰が書いたか」が分からなくなる。
  { id: 'ai', name: 'AIに書かせたもの', glyph: '✦', needsUrl: false, hint: '別のAIの会話で作った文章を貼る（来歴はAI生成になります）' },
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
 *
 * 来歴（origin）は3つに分かれる：
 *   'user'     … メモ・音声メモ（自分で書いた）
 *   'ai'       … 別のAIの会話で書かせたもの（kind:'ai'。中身は検証されていない）
 *   'external' … Web・YouTube・PDF（外部由来）
 * **Ouro の中でAIが動いていないものを 'ai' と偽らない**——'ai' になるのは
 * ユーザーが自分で「AIに書かせた」と選んだ時だけ。
 */
export function ingestOne({ kind = 'note', url = '', title = '', text = '', tags = [], category = 'メモ' }) {
  const k = kind || detectKind(url);
  const source = makeSource({
    type: k,
    title: title || url || '取り込み',
    url,
    excerpt: text,
    addedBy: 'user',
    trust: trustOf(k),
  });

  const { knowledge } = createKnowledge({
    title: title || url || '取り込んだ情報',
    summary: firstSentences(text, 200),
    body: text,
    category,
    tags,
    origin: originOf(k),
    sourceIds: [source.id],
    trust: trustOf(k),
  });

  return { source, knowledge };
}

/** 取り込みの種類 → 来歴。ここが単一の正。 */
export function originOf(kind) {
  if (kind === 'ai') return 'ai';
  if (kind === 'note' || kind === 'audio') return 'user';
  return 'external';
}

/** 確からしさの初期値。AIに書かせたものはいちばん低い（出典が無いため）。 */
export function trustOf(kind) {
  if (kind === 'ai') return 30;
  if (kind === 'note') return 60;
  return 50;
}

function firstSentences(text = '', limit = 200) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

// ここには以前 canReadFile / fileToBase64 があった。
// PDF を選ばせて base64 まで作りながら、その結果をどこにも渡していなかった
// （20MB のファイルで数秒固まるだけで、中身は1文字も読めていなかった）。
// 実際にエンジンへ渡す経路を作る時に、改めて足すこと。

/**
 * 貼り付け・読み込みで受け取る本文の上限。
 * **PDF だけでなく、選んだファイル全部に効かせること。**
 * 大きなテキストをそのまま読むと、端末で数秒固まる。
 */
export const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_TEXT_CHARS = 40000;
