// コンテンツ品質チェック（CI用）。
//   1) スキーマ検証  2) 版番号の健全性  3) 重複（stem/id/論点）
//   4) 網羅マップ集計  5) 数値ファクトの鮮度  6) 全機能一覧のview実在確認
//   7) 経穴カード（keiketsuCards.js）の要穴・分類クロスチェック
//   スキーマ/重複/版番号/経穴クロスチェックにエラーがあれば exit 1（CIを落とす）。
//   網羅・鮮度は警告のみ。
//
//   実行: node scripts/validate-content.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SEED_BANKS, allSeedQuestions } from '../src/data/seedRegistry.js';
import { validateBank } from '../src/lib/questionSchema.js';
import { coverageBySubject, coverageSummary, coverageLevel } from '../src/lib/coverage.js';
import { volatileNumberFacts } from '../src/data/mindmapData.js';
import featureRegistry from '../src/data/featureRegistry.js';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import {
  yuanPoints, luoPoints, xiPoints, muPoints, muPointLocation, shuPoints,
  fourCommandPoints, dualDefinitionPoints, confusablePoints, meridians,
} from '../src/data/knowledgeBase.js';

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

// 6) 全機能一覧（featureRegistry.js）の view が App.jsx に実在するか
line('■ 全機能一覧（featureRegistry.js）');
const appJsxPath = fileURLToPath(new URL('../src/App.jsx', import.meta.url));
const appJsxSrc = readFileSync(appJsxPath, 'utf8');
const validViews = new Set([...appJsxSrc.matchAll(/case '([a-z0-9]+)':/g)].map((m) => m[1]));
const orphanFeatures = featureRegistry.filter((f) => !validViews.has(f.view));
line(`  登録機能数: ${featureRegistry.length}`);
if (orphanFeatures.length) {
  hardFail += orphanFeatures.length;
  line(`  ✗ view が App.jsx に存在しない機能 ${orphanFeatures.length} 件:`);
  for (const f of orphanFeatures) line(`      [${f.id}] view="${f.view}"（${f.title}）`);
} else line('  ✓ 全機能の view はApp.jsxに実在する');
line('');

// 7) 経穴カード（keiketsuCards.js）の要穴クロスチェック。
//    knowledgeBase.js の構造化データ（原穴・絡穴・郄穴・募穴・兪穴・四総穴・
//    二説併記6穴・紛らわしい経穴の対）を単一の正とし、361枚のカードが
//    経絡・分類とも矛盾していないかを毎回機械的に確認する（2026-08-28、
//    muPointLocation.LI/SPの実バグをこの種のクロスチェックで発見した経緯から常設化）。
line('■ 経穴カード（keiketsuCards.js）のクロスチェック');
{
  const byName = new Map();
  KEIKETSU_CARDS.forEach((c) => {
    if (!byName.has(c.name)) byName.set(c.name, []);
    byName.get(c.name).push(c);
  });
  const keiketsuIssues = [];
  const meridianNameOf = (id) => meridians.find((m) => m.id === id)?.name || { CV: '任脈', GV: '督脈' }[id];
  const checkPoint = (pointName, meridianId, roleLabel) => {
    const cards = byName.get(pointName);
    const meridianName = meridianNameOf(meridianId);
    if (!cards) { keiketsuIssues.push(`${roleLabel}「${pointName}」(${meridianName})のカードが見つからない`); return; }
    if (!cards.some((c) => c.meridian === meridianName)) {
      keiketsuIssues.push(`${roleLabel}「${pointName}」は${meridianName}のはずが、実際は[${cards.map((c) => c.meridian).join(', ')}]`);
    }
  };
  Object.entries(yuanPoints).forEach(([m, p]) => checkPoint(p, m, '原穴'));
  Object.entries(luoPoints).forEach(([m, p]) => { if (m !== 'SP_GREAT') checkPoint(p, m, '絡穴'); });
  Object.entries(xiPoints).forEach(([m, p]) => checkPoint(p, m, '郄穴'));
  Object.entries(muPoints).forEach(([m, p]) => {
    const loc = muPointLocation[m];
    checkPoint(p, loc === 'self' ? m : loc, `募穴(${m}の募穴)`);
  });
  Object.entries(shuPoints).forEach(([m, p]) => checkPoint(p, 'BL', `背部兪穴(${m}の兪穴)`));
  fourCommandPoints.forEach((f) => checkPoint(f.point, f.meridian, '四総穴'));
  dualDefinitionPoints.forEach((name) => {
    const cards = byName.get(name);
    if (!cards) { keiketsuIssues.push(`二説併記穴「${name}」のカードが見つからない`); return; }
    cards.forEach((c) => {
      if (!c.location.includes('別説')) keiketsuIssues.push(`二説併記穴「${name}」(${c.id})のlocationに「別説」の記載が無い`);
    });
  });
  confusablePoints.forEach((cp) => {
    checkPoint(cp.a, cp.aMeridian, `confusable(${cp.group})`);
    checkPoint(cp.b, cp.bMeridian, `confusable(${cp.group})`);
  });
  const dupIds = KEIKETSU_CARDS.map((c) => c.id).filter((id, i, arr) => arr.indexOf(id) !== i);
  const dupNames = KEIKETSU_CARDS.map((c) => c.name).filter((n, i, arr) => arr.indexOf(n) !== i);
  if (dupIds.length) keiketsuIssues.push(`id重複: ${[...new Set(dupIds)].join(', ')}`);
  if (dupNames.length) keiketsuIssues.push(`経穴名重複: ${[...new Set(dupNames)].join(', ')}`);

  line(`  総カード数: ${KEIKETSU_CARDS.length}`);
  if (keiketsuIssues.length) {
    hardFail += keiketsuIssues.length;
    line(`  ✗ 要穴・分類の矛盾 ${keiketsuIssues.length} 件:`);
    for (const i of keiketsuIssues) line(`      ${i}`);
  } else {
    line('  ✓ 原穴・絡穴・郄穴・募穴・兪穴・四総穴・二説併記穴・紛らわしい経穴の対、いずれも矛盾なし');
  }
}
line('');

line('===== 結果 =====');
if (hardFail > 0) {
  line(`✗ 重大なエラー ${hardFail} 件。修正が必要です。`);
  process.exit(1);
} else {
  line('✓ スキーマ・重複・版番号の重大エラーなし。');
  process.exit(0);
}
