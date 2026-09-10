import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  IBS_TYPES,
  IBS_TYPE_NOTE,
  IBS_EXCLUSION,
  IBS_PITFALLS,
  IBS_PITFALLS_NOTE,
  IBS_APPROACHES,
  SIBO_POINTS,
  SIBO_NOTE,
  SELF_CARE,
  SELF_CARE_NOTE,
  IBS_CORRECTIONS,
  IBS_UNVERIFIED,
  IBS_PRECHECKS,
  IBS_PRECHECK_WARNING,
  IBS_PARTIAL_OK,
  IBS_SOURCE,
} from '../src/data/ibs.js';
import {
  ibsFermentViews,
  IBS_FERMENT_NOTE,
  mealGapViews,
  MEAL_GAP_CONFLICT_NOTE,
  fermentViews,
  breakfastViews,
} from '../src/lib/conflicts.js';
import { buildTocEntries } from '../src/data/toc.js';

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const codeOf = (path) =>
  src(path)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

// ───────────── いちばん大事な線：検査で異常が出ない＝気のせい、ではない ─────────────

test('「検査で異常が出ない」を、型の一覧より前に置く', () => {
  assert.match(IBS_EXCLUSION.note, /気のせい/);
  assert.match(IBS_EXCLUSION.note, /条件のほう/);
  assert.match(IBS_EXCLUSION.body, /最後に残った/);
  const screen = src('components/Ibs.jsx');
  assert.ok(
    screen.indexOf('id="ibs-exclusion"') < screen.indexOf('id="ibs-types"'),
    '除外診断の項が型の一覧より後ろにある',
  );
  // 受診メモへ行ける（つらいのに伝わらないときに効くのは、記録を持っていくこと）
  assert.match(screen, /onGo\('visitnote'\)/);
});

test('記録から型を当てない（分け方は並べるだけ）', () => {
  assert.equal(IBS_TYPES.length, 4);
  assert.deepEqual(
    IBS_TYPES.map((t) => t.id),
    ['diarrhea', 'constipation', 'mixed', 'unclassified'],
  );
  // ガスで困っている人の居場所が無いことを、必ず書く
  assert.match(IBS_TYPE_NOTE, /ガスの型はありません/);
  assert.match(IBS_TYPE_NOTE, /型を当てません/);
  // 判定する仕組みを持たない
  const code = codeOf('data/ibs.js') + codeOf('components/Ibs.jsx');
  assert.doesNotMatch(code, /function\s+(judge|classify|diagnose|typeOf)\b/i);
  assert.doesNotMatch(code, /\bstreak\b/i);
});

// ───────────────────────── 人を貶めない・受診をあきらめさせない ─────────────────────────

test('医療者を貶める言い方を採らない', () => {
  const byId = Object.fromEntries(IBS_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.doctor_blame, '医療者を貶める言い方への訂正が無い');
  assert.match(byId.doctor_blame.correction, /受診することをやめてしまう/);
  assert.match(byId.doctor_blame.correction, /記録を持っていく/);
  // 引用の外に「無知な医者」を置かない（アプリ自身の言い分にしない）。
  // **行で数える**——実行時の値でソースを差し引く方法は、元の文が複数行に分けて
  // 書いてあると一致しないので必ず落ちる（README 決まり55と同じ）。
  const hits = (codeOf('data/ibs.js') + '\n' + codeOf('components/Ibs.jsx'))
    .split('\n')
    .filter((line) => /無知な医者|やぶ医者|ヤブ医者/.test(line));
  assert.equal(hits.length, 1, `引用の外に医者を貶める語がある:\n${hits.join('\n')}`);
  assert.match(hits[0], /claim:/, '医者を貶める語は、出典の引用の中だけに置く');
});

test('心療内科・精神科を「回された先」として書かない', () => {
  const byId = Object.fromEntries(IBS_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.psych, '心の側の相談についての訂正が無い');
  assert.match(byId.psych.correction, /見放された/);
  assert.match(byId.psych.correction, /行き止まり/);
});

test('市販薬を軽んじる言い方をしない（薬に引いた線をそのまま使う）', () => {
  const byId = Object.fromEntries(IBS_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.otc_lottery, '市販薬を軽んじる言い方への訂正が無い');
  assert.match(byId.otc_lottery.correction, /猛毒/);
  assert.match(byId.otc_lottery.correction, /効かない人がいることと、効く人がいない/);
});

// ───────────────────────── 検査もサプリも勧めない ─────────────────────────

test('検査を先に勧めない・菌を減らすものを自分で手に入れない', () => {
  const byId = Object.fromEntries(IBS_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.test_first, '検査についての訂正が無い');
  assert.match(byId.test_first.correction, /検査を案内しません/);
  assert.match(byId.test_first.correction, /要確認/);
  assert.ok(byId.self_import, '個人輸入についての訂正が無い');
  assert.match(byId.self_import.correction, /中身も量も確かめようがありません/);
  // 検査・サプリの商品名や買い方を画面に置かない
  const screen = codeOf('components/Ibs.jsx');
  assert.doesNotMatch(screen, /購入|買う|注文|通販/);
});

test('ペパーミントオイルは紹介するだけで、勧めない', () => {
  const peppermint = IBS_APPROACHES.find((a) => a.id === 'peppermint');
  assert.ok(peppermint);
  assert.match(peppermint.caution, /商品を勧めません/);
  assert.match(peppermint.caution, /医師・薬剤師/);
  // 合わないことがある人を、印として出し続ける
  const ids = IBS_PRECHECKS.map((p) => p.id);
  for (const id of ['reflux', 'child', 'pregnant', 'meds', 'herbs']) assert.ok(ids.includes(id), id);
  assert.match(IBS_PRECHECK_WARNING, /医師・薬剤師に聞いて/);
});

// ───────────────────────── 原因を1つに決めない ─────────────────────────

test('「原因がわかった」と言い切らない', () => {
  const byId = Object.fromEntries(IBS_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.cause_found, '原因についての訂正が無い');
  assert.match(byId.cause_found.correction, /原因が判明した」という段階ではありません/);
  assert.match(byId.cause_found.correction, /複数のものが重なって/);
  assert.match(byId.cause_found.correction, /要確認/);
});

test('「正しい割合」をアプリが決めない', () => {
  const byId = Object.fromEntries(IBS_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.golden_ratio, '割合についての訂正が無い');
  assert.match(byId.golden_ratio.correction, /割合を計算しません/);
  // 計算する関数を持たない
  const code = codeOf('data/ibs.js') + codeOf('lib/conflicts.js');
  assert.doesNotMatch(code, /function\s+\w*[Rr]atio\w*\s*\(/);
});

// ───────────────────────── 数字は並べるだけ ─────────────────────────

test('出典の数字は、引用の中だけに置いて計算に使わない', () => {
  assert.ok(IBS_UNVERIFIED.length >= 10);
  for (const item of IBS_UNVERIFIED) {
    assert.ok(item.claim, `${item.id}: 出典の言い分が無い`);
    assert.ok(item.note, `${item.id}: 注が無い`);
  }
  const byId = Object.fromEntries(IBS_UNVERIFIED.map((i) => [i.id, i]));
  // 同じ出典の中で数が合わないことも、隠さず書く
  assert.match(byId.patients.note, /数が合いません/);
  assert.match(byId.bacteria_count.note, /桁が動いています/);
  // 割合は「比べる相手」が要ることを書く
  assert.match(byId.peppermint.note, /比べる相手/);
  assert.match(byId.sibo_rate.note, /調べ方/);
  // 計算にも判定にも使わない（食い違いを導く側に数字が入っていない）
  const conflicts = codeOf('lib/conflicts.js');
  for (const bad of [/85/, /1000兆/, /5万/, /6割/, /8割/]) {
    assert.doesNotMatch(conflicts, bad, String(bad));
  }
});

test('文字起こしで欠けている数字を、勝手に作らない', () => {
  const byId = Object.fromEntries(IBS_UNVERIFIED.map((i) => [i.id, i]));
  assert.ok(byId.missing_number, '欠けた数字についての項が無い');
  assert.match(byId.missing_number.claim, /数字が欠けている/);
  assert.match(byId.missing_number.note, /勝手に作りません/);
});

test('歩数も時間も数えない', () => {
  const exercise = IBS_APPROACHES.find((a) => a.id === 'exercise');
  assert.ok(exercise);
  assert.match(exercise.caution, /歩数も時間も数えません/);
  const byId = Object.fromEntries(IBS_UNVERIFIED.map((i) => [i.id, i]));
  assert.match(byId.walk.note, /歩数も時間も数えません/);
});

// ───────────────────────── 食い違いは、どちらも決めない ─────────────────────────

test('同じ「4時間」が別々の理由から出てくることを並べる', () => {
  const views = mealGapViews();
  assert.equal(views.length, 3);
  assert.deepEqual(views.map((v) => v.id), ['adamski', 'mmc', 'self']);
  for (const v of views) {
    assert.equal(v.hours, 4);
    assert.ok(v.why, `${v.id}: 理屈が無い`);
  }
  // 数字がそろっていることを、裏づけと読ませない
  assert.match(MEAL_GAP_CONFLICT_NOTE, /理由はそれぞれ別/);
  assert.match(MEAL_GAP_CONFLICT_NOTE, /裏づけが取れたことと読まないで/);
  assert.match(MEAL_GAP_CONFLICT_NOTE, /採点しません/);
  const byId = Object.fromEntries(IBS_UNVERIFIED.map((i) => [i.id, i]));
  assert.match(byId.four_hours.note, /裏づけとして使ってはいません/);
});

test('ヨーグルト・納豆は4つに割れる（既存の3つを壊さずに足す）', () => {
  // 既存の3つは今までどおり（画面がこれを前提にしている）
  for (const v of fermentViews()) assert.equal(v.views.length, 3, v.name);
  const views = ibsFermentViews();
  assert.equal(views.length, 2);
  for (const v of views) {
    assert.equal(v.views.length, 4, `${v.name}: 4つそろっていない`);
    assert.match(v.views[3], /体験談/);
  }
  assert.match(IBS_FERMENT_NOTE, /条件つきの体験談/);
  assert.match(IBS_FERMENT_NOTE, /どれが正しいかを決めません/);
  // 手書きの一覧を持たない（元データから毎回導く）
  assert.doesNotMatch(codeOf('lib/conflicts.js'), /const IBS_FERMENT_LIST = \[/);
});

test('朝食の食い違いは、これまでの2つのまま（勝手に足さない）', () => {
  assert.equal(breakfastViews().length, 2);
  const light = SELF_CARE.find((s) => s.id === 'light_breakfast');
  assert.ok(light);
  assert.equal(light.clash, true);
  assert.match(light.note, /便が出にくい人には実害/);
  const byId = Object.fromEntries(IBS_CORRECTIONS.map((c) => [c.id, c]));
  assert.ok(byId.breakfast_word, '言葉の成り立ちについての訂正が無い');
  assert.match(byId.breakfast_word.correction, /そこから「朝は固形物をやめるべき」までは決まりません/);
});

// ───────────────────────── 体験談として扱う・数えない ─────────────────────────

test('体験談は7つとして並べ、出典の数え間違いをそのまま写さない', () => {
  assert.equal(SELF_CARE.length, 7);
  assert.match(SELF_CARE_NOTE, /1人の体験談/);
  assert.match(SELF_CARE_NOTE, /やれた数を数えません/);
  assert.match(SELF_CARE_NOTE, /八つ目/);
  assert.match(SELF_CARE_NOTE, /7つとして並べています/);
  assert.match(IBS_PARTIAL_OK, /続いた日数も数えません/);
});

test('落とし穴を、本人の落ち度として書かない', () => {
  assert.equal(IBS_PITFALLS.length, 3);
  assert.match(IBS_PITFALLS_NOTE, /本人の落ち度の話ではありません/);
  assert.match(IBS_PITFALLS_NOTE, /当てはまった数は数えません/);
});

// ───────────────────────── SIBO ─────────────────────────

test('SIBO は名前を先に決めさせず、除菌が全てではないと書く', () => {
  const byId = Object.fromEntries(SIBO_POINTS.map((p) => [p.id, p]));
  assert.ok(byId.not_only_kill, '除菌が全てではない、が無い');
  assert.match(byId.not_only_kill.body, /なぜ増えたのか/);
  assert.match(byId.not_only_kill.body, /多様性/);
  assert.match(SIBO_NOTE, /保険の病名としては認められていない/);
  assert.match(SIBO_NOTE, /当てることをしません/);
});

test('記録の3点セットが、このアプリのやっていることだと書く', () => {
  const diary = IBS_APPROACHES.find((a) => a.id === 'diary');
  assert.ok(diary);
  assert.match(diary.body, /食べたもの/);
  assert.match(diary.body, /便の状態/);
  assert.match(diary.body, /体調や気分/);
  assert.match(diary.caution, /このアプリがそのまま記録しているもの/);
  assert.equal(diary.link.view, 'home');
});

// ───────────────────────── 出典・目次 ─────────────────────────

test('出典に URL を書かない・確かめきれていないことを書く', () => {
  assert.doesNotMatch(codeOf('data/ibs.js'), /https?:\/\//);
  assert.match(IBS_SOURCE.text, /未確認/);
  assert.equal(IBS_SOURCE.check, true);
  assert.match(IBS_SOURCE.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
});

test('目次からも辿れる（画面にある id を指す）', () => {
  const entries = buildTocEntries();
  const byTitle = new Map(entries.map((e) => [e.title, e]));
  const all = [
    ...IBS_TYPES,
    ...IBS_PITFALLS,
    ...IBS_APPROACHES,
    ...SIBO_POINTS,
    ...SELF_CARE,
    ...IBS_CORRECTIONS,
    ...IBS_UNVERIFIED,
  ];
  for (const item of all) assert.ok(byTitle.has(item.title), item.title);
  assert.ok(byTitle.has(IBS_EXCLUSION.title));
  assert.ok(byTitle.has('SIBO'));
  assert.ok(byTitle.has('除外診断'));

  // 飛び先の id が、実際に画面にあること。
  // **テンプレートで組み立てている id は素の文字列でソースに無い**ので、組み立ての形で見る
  const screen = src('components/Ibs.jsx');
  const templates = [
    [/^itype-/, /id=\{`itype-\$\{/],
    [/^ipit-/, /id=\{`ipit-\$\{/],
    [/^iapp-/, /id=\{`iapp-\$\{/],
    [/^sibo-/, /id=\{`sibo-\$\{/],
    [/^iself-/, /id=\{`iself-\$\{/],
    [/^icorrection-/, /id=\{`icorrection-\$\{/],
    [/^iunv-/, /id=\{`iunv-\$\{/],
  ];
  const targets = entries
    .filter((e) => e.group === 'ibs')
    .flatMap((e) => e.destinations)
    .filter((d) => d.view === 'ibs')
    .map((d) => d.targetId);
  assert.ok(targets.length > 0);
  for (const target of targets) {
    const tpl = templates.find(([head]) => head.test(target));
    if (tpl) assert.match(screen, tpl[1], target);
    else assert.match(screen, new RegExp(`id="${target}"`), target);
  }
});
