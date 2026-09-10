import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PROTEIN_FOODS,
  PROTEIN_GUIDES,
  ELIMINATION_TARGETS,
  VITAMIN_D,
  PROTEIN_CORRECTIONS,
  PROTEIN_UNVERIFIED,
  PROTEIN_PRECHECKS,
  PROTEIN_PRECHECK_WARNING,
  PROTEIN_PARTIAL_OK,
  PROTEIN_SOURCE,
} from '../src/data/protein.js';
import {
  FASTING_SHAPES,
  FASTING_CLAIMS,
  FASTING_CORRECTIONS,
  FASTING_UNVERIFIED,
  FASTING_STOP_SIGNS,
  FASTING_STOP_NOTE,
  FASTING_PRECHECKS,
  FASTING_PRECHECK_WARNING,
  FASTING_PARTIAL_OK,
  FASTING_SOURCE,
} from '../src/data/fasting.js';
import {
  MAGNESIUM_CLAIMED_EFFECTS,
  MAGNESIUM_SCOPE_NOTE,
  MAGNESIUM_CORRECTIONS,
  MAGNESIUM_UNVERIFIED,
  MAGNESIUM_SOURCE,
} from '../src/data/magnesium.js';
import { OTC_KINDS } from '../src/data/otcDrugs.js';
import {
  proteinViews,
  PROTEIN_NOTE,
  breakfastViews,
  BREAKFAST_NOTE,
  dairyViews,
  DAIRY_NOTE,
} from '../src/lib/conflicts.js';
import {
  normalizeElimination,
  normalizeEliminations,
  running,
  canStart,
  progressOf,
  progressLine,
  finished,
  RESTORE_NOTE,
} from '../src/lib/elimination.js';
import { buildTocEntries } from '../src/data/toc.js';

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const codeOf = (path) =>
  src(path)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

// ───────────────────────── タンパク質 ─────────────────────────

test('グラム数を計算しない・正しい割合をアプリが決めない', () => {
  const byId = Object.fromEntries(PROTEIN_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.ideal_ratio, '割合の訂正が無い');
  assert.match(byId.ideal_ratio.correction, /計算も採点もしません/);
  assert.match(byId.ideal_ratio.claim, /1対1/, '出典の言い分を消していない');
  assert.match(PROTEIN_PARTIAL_OK, /計算せず/);
  // 足し算・割り算をする関数をどこにも持たない
  for (const path of ['data/protein.js', 'components/Protein.jsx', 'lib/elimination.js']) {
    const code = codeOf(path);
    assert.doesNotMatch(code, /totalProtein|proteinGrams|calcRatio|targetGrams/i, path);
  }
  for (const food of PROTEIN_FOODS) {
    assert.match(food.reading, /^[ぁ-んー]+$/, food.id);
    assert.ok(['animal', 'plant'].includes(food.kind), food.id);
    // 量は文字列（数として持つと必ず計算したくなる）
    assert.equal(typeof food.amount, 'string', food.id);
  }
});

test('文字起こしで欠けていた数字を、勝手に作らない', () => {
  const byId = Object.fromEntries(PROTEIN_GUIDES.map((g) => [g.id, g]));
  assert.ok(byId.not_at_once);
  assert.match(byId.not_at_once.note, /勝手に作らず/);
  // 1食あたりのグラム数を、どこにも書いていない
  assert.doesNotMatch(src('data/protein.js'), /1食あたり[0-9]/);
});

test('サプリの量も飲み方も出さない（ビタミンD）', () => {
  assert.match(VITAMIN_D.caution, /目安量もサプリの飲み方も出しません/);
  assert.match(VITAMIN_D.caution, /取りすぎると害/);
  const byId = Object.fromEntries(PROTEIN_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.vitamind_all, 'すべての病気を防げるという主張への訂正が無い');
  assert.match(byId.vitamind_all.correction, /目安量もサプリの飲み方も出しません/);
  // IU・ミリグラムの目安をアプリの言葉として持たない（引用の中だけ）
  // 引用（出典の言い分と、その見出し）は外して、**アプリ自身の文だけ**を見る
  let rest = src('data/protein.js');
  for (const q of PROTEIN_UNVERIFIED.flatMap((c) => [c.claim, c.title])) rest = rest.split(q).join('');
  rest = rest.split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
  assert.ok(!rest.includes('IU'), 'IU が引用の外に出ている');
});

test('遅延型フードアレルギー検査を当てにしない・腸漏れを前提にしない', () => {
  const byId = Object.fromEntries(PROTEIN_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.igg);
  assert.match(byId.igg.correction, /診断には使えない/);
  assert.match(byId.igg.correction, /栄養が偏るほうが害/);
  assert.ok(byId.leaky);
  assert.match(byId.leaky.correction, /病名は確立していません/);
  // 既存（酪酸菌・善玉菌の餌）の訂正と同じ向きであること
  assert.match(byId.leaky.correction, /医療機関/);
});

test('タンパク質の裏が取れていない主張に、必ず注意が付く', () => {
  assert.ok(PROTEIN_UNVERIFIED.length >= 7);
  for (const item of PROTEIN_UNVERIFIED) {
    assert.ok(item.claim && item.note, item.id);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  }
  const byId = Object.fromEntries(PROTEIN_UNVERIFIED.map((c) => [c.id, c]));
  // 1人の成功談を、根拠として置かない
  assert.match(byId.djokovic.note, /1人の話/);
  assert.match(byId.djokovic.note, /うまくいった人の話だけ/);
  // 乳糖不耐症は「量による」を必ず添える
  assert.match(byId.lactose_ninety.note, /量によっては平気/);
});

// ───────────────────── ためしにやめてみる ─────────────────────

test('やめたままにさせない（除去は試すためのもの）', () => {
  assert.match(RESTORE_NOTE, /続けるためのものではありません/);
  assert.match(RESTORE_NOTE, /もとに戻して/);
  assert.match(RESTORE_NOTE, /栄養が偏るほうが害/);
  for (const target of ELIMINATION_TARGETS) {
    assert.ok(Number.isInteger(target.days) && target.days > 0, target.id);
    assert.match(target.reading, /^[ぁ-んー]+$/, target.id);
    assert.ok(target.caution, target.id);
  }
  // 期間が来たら「戻してみる」を出す。**良くなったかは聞かない**
  const entry = normalizeElimination({ targetId: 'gluten', startedOn: '2026-09-01' });
  const line = progressLine(progressOf(entry, '2026-09-10'));
  assert.match(line, /もとに戻して/);
  assert.doesNotMatch(line, /よくなりましたか|効果はありましたか|改善しましたか/);
});

test('同時に2つやめない（断るだけで、勝手に入れ替えない）', () => {
  const list = normalizeEliminations([{ targetId: 'gluten', startedOn: '2026-09-01' }]);
  assert.equal(list.length, 1);
  assert.ok(running(list));
  const check = canStart(list, 'dairy');
  assert.equal(check.ok, false);
  assert.match(check.reason, /どちらが効いたのか分からなくなります/);
  // 断るだけ——元のものは動かさない
  assert.equal(running(list).targetId, 'gluten');
  // 終えれば次を始められる
  const ended = list.map((e) => ({ ...e, endedOn: '2026-09-06' }));
  assert.equal(canStart(normalizeEliminations(ended), 'dairy').ok, true);
  assert.equal(running(normalizeEliminations(ended)), null);
  // 知らない食べものは受け取らない
  assert.equal(normalizeElimination({ targetId: 'にせもの', startedOn: '2026-09-01' }), null);
  assert.equal(normalizeElimination({ targetId: 'gluten', startedOn: 'ですです' }), null);
});

test('守れた日数を数えない・良し悪しを保存しない', () => {
  const entry = normalizeElimination({ targetId: 'gluten', startedOn: '2026-09-01' });
  assert.deepEqual(Object.keys(entry).sort(), ['endedOn', 'id', 'note', 'startedOn', 'targetId']);
  const progress = progressOf(entry, '2026-09-03');
  assert.equal(progress.elapsed, 3, '始めてから何日目か、だけを出す');
  assert.ok(!('keptDays' in progress), '守れた日数を持たない');
  assert.ok(!('score' in progress), '採点しない');
  const code = codeOf('lib/elimination.js');
  assert.doesNotMatch(code, /\bstreak\b/i);
  assert.doesNotMatch(code, /連続/);
  // 済んだものは新しい順に並べるだけ
  const list = normalizeEliminations([
    { targetId: 'gluten', startedOn: '2026-08-01', endedOn: '2026-08-06' },
    { targetId: 'dairy', startedOn: '2026-09-01', endedOn: '2026-09-15' },
  ]);
  assert.deepEqual(finished(list).map((e) => e.targetId), ['dairy', 'gluten']);
});

// ───────────────────────── 断食 ─────────────────────────

test('断食でがんが治るとは書かない（この出典でいちばん危ない一文）', () => {
  const byId = Object.fromEntries(FASTING_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.cancer, 'がんの訂正が無い');
  assert.match(byId.cancer.correction, /治療を遅らせる/);
  assert.match(byId.cancer.correction, /主治医/);
  assert.match(byId.cancer.claim, /寛解/, '元の言い分を消していない');
  // アプリ自身の文で、食べ方でがんが治る・防げると書かない
  const screen = codeOf('components/Fasting.jsx');
  assert.doesNotMatch(screen, /がんが治る|がんを予防|がん予防/);
});

test('宿便・血液が汚れる・酸とアルカリを、そのまま通さない', () => {
  const byId = Object.fromEntries(FASTING_CORRECTIONS.map((c) => [c.id, c]));
  for (const id of ['stool_stuck', 'blood_dirty', 'acid_alkaline', 'miso_atomic', 'spine_organ']) {
    assert.ok(byId[id], `${id} の訂正が無い`);
    assert.ok(byId[id].claim, `${id}: 元の言い分を消していない`);
    assert.match(byId[id].reading, /^[ぁ-んー]+$/, id);
  }
  assert.match(byId.stool_stuck.correction, /医学の言葉ではありません/);
  assert.match(byId.stool_stuck.correction, /強い下剤/);
  assert.match(byId.blood_dirty.correction, /医学の言葉ではありません/);
  assert.match(byId.acid_alkaline.correction, /呼吸と腎臓/);
  assert.match(byId.acid_alkaline.correction, /緑茶/, '緑茶がアルカリ性という話も訂正する');
  assert.match(byId.miso_atomic.correction, /確かめられた調査は見つかっていません/);
  assert.match(byId.spine_organ.correction, /確かめられたものではありません/);
});

test('やめどきを、始め方より先に置く', () => {
  assert.ok(FASTING_STOP_SIGNS.length >= 5);
  const signs = FASTING_STOP_SIGNS.join('\n');
  assert.match(signs, /低血糖/);
  assert.match(signs, /体重が減って/);
  assert.match(FASTING_STOP_NOTE, /その日にやめてかまいません/);
  assert.match(FASTING_STOP_NOTE, /数えないので/);
  // 画面の並びでも、やめどきがやり方より先に出る
  const screen = src('components/Fasting.jsx');
  assert.ok(
    screen.indexOf('id="fasting-stop"') < screen.indexOf('id="fasting-shapes"'),
    'やめどきがやり方より後ろにある',
  );
});

test('断食の日数も時間も数えない・アプリは勧めない', () => {
  assert.match(FASTING_PARTIAL_OK, /勧めていません/);
  assert.match(FASTING_PARTIAL_OK, /数えません/);
  const code = codeOf('data/fasting.js') + codeOf('components/Fasting.jsx');
  assert.doesNotMatch(code, /\bstreak\b/i);
  assert.doesNotMatch(code, /連続\s*[0-9]/);
  // 時間を計る仕組みを持たない
  assert.doesNotMatch(code, /setInterval|Date\.now\(\)|elapsedHours/);
  for (const shape of FASTING_SHAPES) assert.match(shape.reading, /^[ぁ-んー]+$/, shape.id);
});

test('空腹が向かない人を、止めずに出し続ける', () => {
  const ids = FASTING_PRECHECKS.map((p) => p.id);
  for (const id of ['diabetes', 'medicine', 'pregnant', 'growing', 'eating', 'ibs']) {
    assert.ok(ids.includes(id), id);
  }
  assert.match(FASTING_PRECHECK_WARNING, /低血糖/);
  assert.match(FASTING_PRECHECK_WARNING, /医師|薬剤師/);
  // 画面のいちばん上にも出す（チェックしていなくても見える）
  assert.match(codeOf('components/Fasting.jsx'), /向かない人がいます/);
  for (const item of FASTING_UNVERIFIED) {
    assert.ok(item.claim && item.note, item.id);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  }
});

// ───────────────────────── マグネシウム ─────────────────────────

test('処方されている便秘の薬を、自分でやめさせない', () => {
  const byId = Object.fromEntries(MAGNESIUM_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.stop_laxative);
  assert.match(byId.stop_laxative.correction, /便秘が悪化/);
  assert.match(byId.stop_laxative.correction, /医師|薬剤師/);
  assert.match(byId.stop_laxative.correction, /腎臓/);
  // 市販薬の一覧にも入っていて、同じことを書く
  const kind = OTC_KINDS.find((k) => k.id === 'magnesium');
  assert.ok(kind, '市販薬の一覧に無い');
  assert.match(kind.doctor, /やめないでください/);
  assert.match(kind.doctor, /腎臓/);
  // 見出しの数字から量を決めない
  assert.ok(byId.dose_in_title);
  assert.match(byId.dose_in_title.correction, /目安量を出しません/);
  // 「自然な睡眠薬」と呼ばない
  assert.ok(byId.not_a_drug);
  assert.match(byId.not_a_drug.correction, /医療機関/);
});

test('腸の話でないものは、腸のアプリで扱わないとはっきり書く', () => {
  const gut = MAGNESIUM_CLAIMED_EFFECTS.filter((e) => e.gut);
  assert.equal(gut.length, 1, '腸の話は「腸を動かす」だけ');
  assert.equal(gut[0].id, 'bowel');
  assert.ok(MAGNESIUM_CLAIMED_EFFECTS.length >= 6);
  assert.match(MAGNESIUM_SCOPE_NOTE, /扱いません/);
  assert.match(MAGNESIUM_SCOPE_NOTE, /医療機関/);
  for (const item of MAGNESIUM_CLAIMED_EFFECTS) assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  for (const item of MAGNESIUM_UNVERIFIED) {
    assert.ok(item.claim && item.note, item.id);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  }
});

// ───────────────────────── 食い違い ─────────────────────────

test('肉と魚は、増やす側と避ける側の両方を並べる', () => {
  const views = proteinViews();
  assert.equal(views.length, 2);
  assert.deepEqual(views.map((v) => v.id), ['protein_first', 'weak_stomach']);
  for (const v of views) assert.ok(v.side && v.applies && v.says && v.why && v.source, v.id);
  assert.match(PROTEIN_NOTE, /決めません/);
  assert.doesNotMatch(PROTEIN_NOTE, /正しいのは|おすすめは/);
  // 手書きの一覧を持たず、元データから導く
  assert.doesNotMatch(codeOf('lib/conflicts.js'), /const PROTEIN_CLASH = \[/);
});

test('朝食を抜くか朝に食べるかを、決めずに並べる', () => {
  const views = breakfastViews();
  assert.equal(views.length, 2);
  assert.deepEqual(views.map((v) => v.id), ['skip', 'eat']);
  assert.match(BREAKFAST_NOTE, /決めません/);
  // 便が出にくい人への実害を必ず書く
  assert.match(BREAKFAST_NOTE, /出にくくなる人がいます/);
});

test('乳製品は3つの言い分を並べる', () => {
  const views = dairyViews();
  assert.ok(views.length >= 2);
  for (const v of views) {
    assert.equal(v.views.length, 3, `${v.name}: 3つそろっていない`);
    assert.match(v.views[0], /腸活/);
    assert.match(v.views[1], /低FODMAP/);
    assert.match(v.views[2], /やめて/);
  }
  assert.match(DAIRY_NOTE, /決めません/);
});

// ───────────────────────── 出典・目次 ─────────────────────────

test('出典に URL を書かない・確かめきれていないことを書く', () => {
  for (const path of ['data/protein.js', 'data/fasting.js', 'data/magnesium.js']) {
    assert.doesNotMatch(src(path), /https?:\/\//, path);
  }
  for (const source of [PROTEIN_SOURCE, FASTING_SOURCE, MAGNESIUM_SOURCE]) {
    assert.equal(source.check, true);
    assert.match(source.text, /未確認/);
    assert.match(source.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.match(PROTEIN_PRECHECK_WARNING, /腎臓/);
  assert.ok(PROTEIN_PRECHECKS.some((p) => p.id === 'eating'));
});

test('目次からも辿れる（画面にある id を指す）', () => {
  const entries = buildTocEntries();
  const byTitle = new Map(entries.map((e) => [e.title, e]));
  for (const food of PROTEIN_FOODS) assert.ok(byTitle.has(`${food.name}（タンパク質）`), food.name);
  for (const target of ELIMINATION_TARGETS) assert.ok(byTitle.has(`${target.name}をやめてみる`), target.id);
  for (const item of [...PROTEIN_GUIDES, ...PROTEIN_CORRECTIONS, ...PROTEIN_UNVERIFIED]) {
    assert.ok(byTitle.has(item.title), item.title);
  }
  for (const item of [...FASTING_SHAPES, ...FASTING_CLAIMS, ...FASTING_CORRECTIONS, ...FASTING_UNVERIFIED]) {
    assert.ok(byTitle.has(item.title), item.title);
  }
  for (const item of [...MAGNESIUM_CORRECTIONS, ...MAGNESIUM_UNVERIFIED]) {
    assert.ok(byTitle.has(item.title), item.title);
  }
  assert.ok(byTitle.has(VITAMIN_D.title));

  const screens = {
    protein: src('components/Protein.jsx'),
    fasting: src('components/Fasting.jsx'),
    otc: src('components/OtcDrugs.jsx'),
  };
  const templates = [
    [/^protein-(?!foods|guides|vs|elimination|dairy|vitamind|corrections|unverified|precheck|source)/, /id=\{`protein-\$\{/],
    [/^guide-/, /id=\{`guide-\$\{/],
    [/^elim-/, /id=\{`elim-\$\{/],
    [/^prcorrection-/, /id=\{`prcorrection-\$\{/],
    [/^prunv-/, /id=\{`prunv-\$\{/],
    [/^shape-/, /id=\{`shape-\$\{/],
    [/^fclaim-/, /id=\{`fclaim-\$\{/],
    [/^fcorrection-/, /id=\{`fcorrection-\$\{/],
    [/^funv-/, /id=\{`funv-\$\{/],
    [/^mgcorrection-/, /id=\{`mgcorrection-\$\{/],
    [/^mgunv-/, /id=\{`mgunv-\$\{/],
  ];
  const targets = entries
    .filter((e) => ['protein', 'fasting'].includes(e.group))
    .flatMap((e) => e.destinations)
    .filter((d) => screens[d.view]);
  assert.ok(targets.length > 0);
  for (const dest of targets) {
    const screen = screens[dest.view];
    if (screen.includes(`id="${dest.targetId}"`)) continue;
    const tpl = templates.find(([prefix]) => prefix.test(dest.targetId));
    assert.ok(tpl, `${dest.targetId}: 画面に無い`);
    assert.match(screen, tpl[1], dest.targetId);
  }
});
