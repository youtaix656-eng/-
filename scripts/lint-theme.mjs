// UIトークンLint（#16）— 黒背景・白文字テーマの不変条件を機械チェックする。
//   :root のデザイントークンが「背景=暗い / 文字=明るい」を満たすか検証し、
//   崩れていたら exit 1（CIを落とす）。先日統一した黒テーマを恒久的に守る。
//
//   実行: node scripts/lint-theme.mjs

import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf-8');

// 最初の :root { … } ブロックからトークンを取り出す
const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/);
if (!rootMatch) { console.error('✗ :root ブロックが見つかりません'); process.exit(1); }
const tokens = {};
for (const m of rootMatch[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  tokens[m[1].trim()] = m[2].trim();
}

// #rgb / #rrggbb → 相対輝度（0=黒, 1=白）。hex 以外は null。
function luminance(v) {
  const m = String(v).match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const toLin = (c8) => {
    const c = c8 / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = toLin(parseInt(h.slice(0, 2), 16));
  const g = toLin(parseInt(h.slice(2, 4), 16));
  const b = toLin(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// コントラスト比（WCAG）
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la == null || lb == null) return null;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const errors = [];
const need = (name) => { if (!(name in tokens)) errors.push(`トークン ${name} が未定義`); };
['--bg', '--text', '--surface', '--surface-2', '--text-sub'].forEach(need);

const check = (name, cond, msg) => { if (name in tokens && !cond(tokens[name])) errors.push(`${name}: ${msg}（現在 ${tokens[name]}）`); };
// 背景系は暗く（輝度 < 0.15）、文字系は明るく（輝度 > 0.6）
check('--bg', (v) => (luminance(v) ?? 1) < 0.15, '背景が暗くない（黒背景であるべき）');
check('--surface', (v) => (luminance(v) ?? 1) < 0.2, 'カード背景が暗くない');
check('--surface-2', (v) => (luminance(v) ?? 1) < 0.25, '入力欄背景が暗くない');
check('--text', (v) => (luminance(v) ?? 0) > 0.6, '本文文字が明るくない（白文字であるべき）');
check('--text-sub', (v) => (luminance(v) ?? 0) > 0.4, '副文が暗すぎる');

// 本文コントラスト（背景×文字）は WCAG AA（4.5:1）以上
const cr = contrast(tokens['--bg'], tokens['--text']);
if (cr != null && cr < 4.5) errors.push(`本文コントラストが低い（--bg×--text = ${cr.toFixed(1)}:1、4.5:1以上必要）`);

// body が必ずトークンを使っているか（ハードコード背景でテーマを外していないか）。
//   `html, body { … }` など複数の body ルールがあるため、全ブロックを合わせて確認する。
const bodyBlocks = [...css.matchAll(/body\s*\{([\s\S]*?)\}/g)].map((m) => m[1]);
const bodyHasBg = bodyBlocks.some((b) => /background:\s*var\(--bg\)/.test(b));
const bodyHasColor = bodyBlocks.some((b) => /color:\s*var\(--text\)/.test(b));
if (!bodyHasBg) errors.push('body の background が var(--bg) でない');
if (!bodyHasColor) errors.push('body の color が var(--text) でない');

if (errors.length) {
  console.error('✗ テーマLint 失敗（黒背景・白文字の不変条件）:');
  errors.forEach((e) => console.error('   - ' + e));
  process.exit(1);
}
console.log(`✓ テーマLint OK（--bg×--text コントラスト ${cr ? cr.toFixed(1) : '?'}:1）`);
