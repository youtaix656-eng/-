// コンテンツ品質チェック（CI用）。
//   1) スキーマ検証  2) 版番号の健全性  3) 重複（stem/id/論点）
//   4) 網羅マップ集計  5) 数値ファクトの鮮度
//   スキーマ/重複/版番号にエラーがあれば exit 1（CIを落とす）。網羅・鮮度は警告のみ。
//
//   実行: node scripts/validate-content.mjs

import { SEED_BANKS, allSeedQuestions } from '../src/data/seedRegistry.js';
import { validateBank } from '../src/lib/questionSchema.js';
import { coverageBySubject, coverageSummary, coverageLevel } from '../src/lib/coverage.js';
import { volatileNumberFacts } from '../src/data/mindmapData.js';

const line = (s = '') => process.stdout.write(s + '\n');
let hardFail = 0;

line('===== コンテンツ品質チェック =====\n');

// 1) 版番号の健全性（version 管理のバンクは 1 以上の整数であること）
line('■ 版番号（シード）');
for (const b of SEED_BANKS) {
  if (b.version == null) { line(`  - ${b.name}: 版管理なし（${b.questions.length}問）`); continue; }
  const bad = !Number.isInteger(b.version) || b.version < 1;
  if (bad) { hardFail++; line(`  ✗ ${b.name}: 版番号が不正（${b.version}）`); }
  else line(`  - ${b.name}: v${b.version}（${b.questions.length}問）`);
}
line('');

// 2)+3) スキーマ＋重複（バンクごと＋全体）
line('■ スキーマ・重複');
const all = allSeedQuestions();
const rep = validateBank(all);
line(`  総問題数（シード対象）: ${rep.total}`);
if (rep.perQuestion.length) {
  hardFail += rep.perQuestion.length;
  line(`  ✗ スキーマ違反 ${rep.perQuestion.length} 件:`);
  for (const e of rep.perQuestion.slice(0, 40)) line(`      [${e.id}] ${e.errors.join(' / ')}`);
  if (rep.perQuestion.length > 40) line(`      …ほか ${rep.perQuestion.length - 40} 件`);
} else line('  ✓ スキーマ違反なし');

if (rep.dupIds.length) {
  hardFail += rep.dupIds.length;
  line(`  ✗ 重複 id ${rep.dupIds.length} 件: ${rep.dupIds.map((d) => `${d.id}(${d.count})`).join(', ')}`);
} else line('  ✓ 重複 id なし');

if (rep.dupStems.length) {
  hardFail += rep.dupStems.length;
  line(`  ✗ 完全一致の重複問題文 ${rep.dupStems.length} 件（取り込みで消えるため（第XX回）等で一意化が必要）:`);
  for (const d of rep.dupStems.slice(0, 20)) line(`      ×${d.count} 「${d.stem.slice(0, 40)}」`);
} else line('  ✓ 重複問題文なし');

line(`  ・論点の被り候補（要目視・警告）: ${rep.logicalDups.length} 件`);
line('');

// 4) 網羅マップ集計
line('■ 網羅マップ（科目 × 収録数）');
const rows = coverageBySubject(all);
const sum = coverageSummary(rows);
for (const r of rows) {
  const lv = coverageLevel(r.total);
  const mark = lv === 'none' ? '🔴' : lv === 'thin' ? '🟠' : lv === 'ok' ? '🟡' : '🟢';
  line(`  ${mark} ${r.name}: ${r.total}問`);
}
line(`  → 収録済み ${sum.withData}/${sum.subjects}科目・総${sum.total}問 ｜ 手薄(20未満) ${sum.thin.length} ｜ 未収録 ${sum.none.length}`);
if (sum.none.length) line(`     未収録: ${sum.none.map((r) => r.name).join('・')}`);
if (sum.thin.length) line(`     手薄: ${sum.thin.map((r) => `${r.name}(${r.total})`).join('・')}`);
line('');

// 5) 数値ファクトの鮮度（volatile=毎年変わる数値）
line('■ 数値の鮮度（volatile）');
const vol = volatileNumberFacts();
if (!vol.length) line('  （volatile 指定の数値なし）');
for (const n of vol) {
  line(`  ⚠ ${n.topic} = ${n.value}${n.asOf ? `（as of ${n.asOf}）` : '（asOf 未設定）'}`);
}
line('  ※ 毎年見直す数値。国民医療費・結核患者数などは最新値を確認（※要確認）。');
line('');

line('===== 結果 =====');
if (hardFail > 0) {
  line(`✗ 重大なエラー ${hardFail} 件。修正が必要です。`);
  process.exit(1);
} else {
  line('✓ スキーマ・重複・版番号の重大エラーなし。');
  process.exit(0);
}
