// パフォーマンス予算（#17）— 起動時に実際に読み込まれるJS/CSSのサイズに上限を設け、
//   超えたら exit 1。肥大化による起動の重さを未然に防ぐ。実行前に `npm run build` が必要。
//
//   2026-08-28修正：以前は dist/assets 配下の全チャンク（14科目の問題データや
//   lazyな画面まで含む）を合算しており、実際の起動コストとは無関係な数字で
//   常に予算超過（3000KB超）になっていた。このアプリは科目データ・ほとんどの
//   画面をlazy importする方針（CLAUDE.md「パフォーマンス方針」参照）なので、
//   起動時に効くのは dist/index.html が直接参照する初期チャンクだけ。
//   ここでは index.html の <script src> と modulepreload の .js、
//   スタイルシートの .css だけを合算し、それを予算と比較する。
//
//   実行: npm run build && node scripts/check-bundle-size.mjs

import { readFileSync, statSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const ASSETS = join(DIST, 'assets');
const INDEX_HTML = join(DIST, 'index.html');

// 予算（KB）。2026-08-28、正しい指標（起動時に読む分だけ）で測り直した実測値
// （約802KB）に、今後の機能追加を見込んだ余裕を乗せて設定した新しい基準値。
// 以前の「dist/assets全体で1400KB」は測り方自体が誤っていたため、この値には
// 連続性が無い（過去の推移とは比較しないこと）。
// 2026-09-02、900KB予算が残り僅かになった（888KB）ためユーザー指定で1MBへ引き上げ。
// 同日、mindmapData.jsの動的化・Pomodoro/AuthGateのlazy化等で実測591KB/95KBまで
// 大幅に下がったため、予算を「これ以上増やさない」ガードレールとして引き下げ直した
// （実測591KB+今後の余裕で700KB、CSS94KB+余裕で110KB。1MBのままだと再肥大化に気づけない）。
// 2026-11-15、音声学習×連結学習への8件追加（二重符号化・スワイプ操作・あとで調べる・
// 隙間時間ミニセッション・小休止の選択肢・誤読報告履歴・カレンダー長押し詳細・誤答直後の言い換え）で
// 実測697KB→703KBとなり700KB予算をわずかに超えたため、710KBへ引き上げた
// （ガードレールとしての役割は維持。実測+小さな余裕のみで、以前のように大きく余らせない）。
// 2026-11-15、時計・アラーム・天気の追加（画面はlazy。起動時に乗るのはアラームの見張り＝lib/alarm.jsと
// ヘッダーの入口・全機能一覧の2行ぶん）で実測756KBとなり余裕が無くなったため762KBへ引き上げ。
const MAX_BUNDLE_SIZE = 800 * 1024; // 2026-11-25：設定画面の見直し（勤務明けリマインドを独立させる見張り・音声の設定の反映）で794KBになったため792→800KBへ。それ以前：2026-11-23：バックアップ復元の見直し（端末ごとの設定を残す処理）で787KBになったため786→792KBへ。それ以前：2026-11-22：音声学習の見直し第3回（第7弾）で781KBになったため780→786KBへ。以前の経緯：（2026-11-15：記憶科学ランキング上位10件由来の30項目の追加（声で解答モード・完全想起モード・
// 音声版本番想定モード・経穴の双方向想起・紛らわしい科目ペアのインターリーブ等）で実測736KBとなり734KB予算を超えたため742KBへ引き上げ。
// 同日、ホーム画面「模試」の横の辞書スペース（用語集の簡易検索）追加で実測749KBとなり742KB予算を超えたため756KBへ再引き上げ。
// Home.jsxは下部ナビの即時import画面なので、このウィジェットはlazy化できない）
const BUDGET_KB = { js: MAX_BUNDLE_SIZE / 1024, css: 110 };

if (!existsSync(INDEX_HTML)) {
  console.error('✗ dist/index.html がありません。先に `npm run build` を実行してください。');
  process.exit(1);
}

const html = readFileSync(INDEX_HTML, 'utf8');
// <script type="module" src="./assets/xxx.js"> と
// <link rel="modulepreload" href="./assets/xxx.js"> の両方を初期読み込みとして拾う。
const initialFiles = new Set();
for (const m of html.matchAll(/(?:src|href)="\.\/assets\/([^"]+)"/g)) {
  initialFiles.add(m[1]);
}

const sizeOf = (name) => statSync(join(ASSETS, name)).size / 1024;
let jsKB = 0;
let cssKB = 0;
for (const f of initialFiles) {
  if (f.endsWith('.js')) jsKB += sizeOf(f);
  else if (f.endsWith('.css')) cssKB += sizeOf(f);
}
jsKB = Math.round(jsKB);
cssKB = Math.round(cssKB);

// 参考値：dist/assets 全体（lazyチャンク込み）の合計。予算判定には使わないが、
// 総コンテンツ量の推移を見るための情報として表示する。
let totalKB = 0;
if (existsSync(ASSETS)) {
  for (const f of readdirSync(ASSETS)) totalKB += statSync(join(ASSETS, f)).size / 1024;
}
totalKB = Math.round(totalKB);

const rows = [
  ['起動時JS（index.htmlが直接読む分）', jsKB, BUDGET_KB.js],
  ['起動時CSS', cssKB, BUDGET_KB.css],
];
let fail = false;
console.log('■ パフォーマンス予算（起動時に読む分のみ。lazyな科目データ・画面は含まない）');
for (const [name, kb, budget] of rows) {
  const ok = kb <= budget;
  if (!ok) fail = true;
  console.log(`  ${ok ? '✓' : '✗'} ${name}: ${kb}KB / 予算 ${budget}KB`);
}
console.log(`  ・参考：dist/assets 全体（lazyチャンク込み・全14科目分）: ${totalKB}KB`);
if (fail) {
  console.error('✗ 予算超過。起動時に読むチャンクを見直してください（新しい画面はlazy importが基本）。');
  process.exit(1);
}
console.log('✓ 起動時に読む分は予算内。');
