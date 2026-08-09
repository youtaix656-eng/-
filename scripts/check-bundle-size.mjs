// パフォーマンス予算（#17）— ビルド成果物のサイズに上限を設け、超えたら exit 1。
//   肥大化による起動の重さを未然に防ぐ。実行前に `npm run build` が必要。
//
//   実行: npm run build && node scripts/check-bundle-size.mjs

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = new URL('../dist/assets/', import.meta.url).pathname;

// 予算（KB）。将来の機能追加を見込んで少し余裕を持たせる。超えたら失敗。
const BUDGET_KB = { js: 1400, css: 200 };

if (!existsSync(ASSETS)) {
  console.error('✗ dist/assets がありません。先に `npm run build` を実行してください。');
  process.exit(1);
}

let jsKB = 0;
let cssKB = 0;
const files = readdirSync(ASSETS);
for (const f of files) {
  const kb = statSync(join(ASSETS, f)).size / 1024;
  if (f.endsWith('.js')) jsKB += kb;
  else if (f.endsWith('.css')) cssKB += kb;
}
jsKB = Math.round(jsKB);
cssKB = Math.round(cssKB);

const rows = [
  ['JS 合計', jsKB, BUDGET_KB.js],
  ['CSS 合計', cssKB, BUDGET_KB.css],
];
let fail = false;
console.log('■ パフォーマンス予算');
for (const [name, kb, budget] of rows) {
  const ok = kb <= budget;
  if (!ok) fail = true;
  console.log(`  ${ok ? '✓' : '✗'} ${name}: ${kb}KB / 予算 ${budget}KB`);
}
if (fail) {
  console.error('✗ 予算超過。コード分割・不要依存の削減を検討してください。');
  process.exit(1);
}
console.log('✓ すべて予算内。');
