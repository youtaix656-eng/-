// 最初に読む量の見張り（新項目29）。
//
// 速さは一度直しても、機能を足すうちにじわじわ戻る。
// 「起動時に読むファイル」の合計を毎回のビルドで測り、増えたらその場で言う。
//
//   npm run build … 警告だけ（デプロイは止めない）
//   npm run size  … 上限を超えていたら失敗する
//
// 数えるのは index.html が起動時に読むもの＝入口のJS・CSSと modulepreload だけ。
// あとから読む画面（lazy）は入っていない。

import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// gzip 後のキロバイト。実測 103.6KB（2026-08-25）を基準にした。
// 内訳の目安：React 44 ／ アプリ本体 49 ／ 役職・キャラクターの索引 11 ／ CSS 4。
// **React の44KBは動かせない**ので、増減するのは実質アプリ本体と索引。
//
// 2026-08-26：台帳（lib/ledger.js・outline.js・decisions.js・handoff.js）で
// アプリ本体が 4.7KB 増えて 112.8KB になった。ホームの「今日やること」を
// 最初の描画で出すため、この4つは起動時に要る（CSV まわりは ledgerCsv.js へ
// 分けて外した）。原因を確かめたうえで目安を上げている。
//
// 2026-08-26（チーム機能）：掲示板・朝会・在席・会議の材料・相談を足して
// 116.6KB。**足す前に、外せるものを先に外した**——board / meeting / related /
// standup / briefing / consult は押した時に読む形（loadTeamwork）へ移し、
// 会社の画面とホームの下半分も lazy にしてある。
// 起動時に残っているのは presence.js（社員タブが最初の描画で使う）だけ。
// **次にここを超える時は、目安を上げる前に外せるものを探すこと。**
// 上限 125KB は動かさない。
// 2026-08-27：チーム機能の追加ぶんは、依頼（Compose）を lazy に回して相殺した
// （目次・予定と同じ扱い。押す前に先読みするので待ちは実質ゼロ）。
// 117.9KB → 115.8KB。**目安は上げずに下げている**——次に足すときも、
// まず「起動時から外せるもの」を探すこと。
const WARN_KB = 110;
const MAX_KB = 120;

function eagerAssets(html) {
  const out = new Set();
  const add = (m) => {
    if (m) out.add(m.replace(/^\.\//, ''));
  };
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) add(m[1]);
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)) add(m[1]);
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) add(m[1]);
  return [...out];
}

function main() {
  let html;
  try {
    html = readFileSync(join(dist, 'index.html'), 'utf8');
  } catch {
    console.error('dist/index.html がありません。先に npm run build を実行してください。');
    process.exit(1);
  }

  const files = eagerAssets(html);
  let total = 0;
  const rows = [];
  for (const f of files) {
    const p = join(dist, f);
    try {
      statSync(p);
    } catch {
      continue; // 外部URLなど、手元に無いものは数えない
    }
    const gz = gzipSync(readFileSync(p)).length;
    total += gz;
    rows.push([f, gz]);
  }

  const kb = total / 1024;
  rows.sort((a, b) => b[1] - a[1]);
  for (const [f, gz] of rows) console.log(`  ${(gz / 1024).toFixed(1).padStart(6)}KB  ${f}`);
  console.log(`  ${'─'.repeat(28)}`);
  console.log(`  ${kb.toFixed(1).padStart(6)}KB  起動時に読む合計（gzip）`);

  const strict = process.argv.includes('--strict');
  if (kb > MAX_KB) {
    console.error(`\n  ✗ 上限 ${MAX_KB}KB を超えています。新しい画面は lazy にできていますか。`);
    process.exit(strict ? 1 : 0);
  }
  if (kb > WARN_KB) {
    console.warn(`\n  ! 目安 ${WARN_KB}KB を超えました（上限 ${MAX_KB}KB）。増えた原因を確かめてください。`);
  }
}

main();
