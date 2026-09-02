import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BACTERIA,
  PRODUCTS,
  PROBIOTIC_CORRECTIONS,
  PROBIOTIC_UNVERIFIED,
  PROBIOTIC_PRECHECKS,
  PROBIOTIC_FAQ,
  PROBIOTIC_SOURCE,
  NO_INTERACTION_CHECK,
  TRIAL_DAYS,
  TRIAL_NOTE,
} from '../src/data/probiotics.js';
import {
  SEASONINGS,
  SEASONING_AVOID,
  SEASONING_CHOICES,
  SEASONING_PARTIAL_OK,
  SEASONING_SOURCE,
} from '../src/data/seasonings.js';
import {
  emptyProbiotic,
  normalizeProbiotic,
  isRegistered,
  trialProgress,
  trialLine,
  othersThan,
} from '../src/lib/probiotic.js';
import { normalizeDay } from '../src/lib/days.js';
import { buildTocEntries } from '../src/data/toc.js';

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const codeOf = (path) =>
  src(path)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

test('整腸剤は登録するだけ（効いたかを記録しない）', () => {
  const empty = emptyProbiotic();
  assert.deepEqual(Object.keys(empty).sort(), ['name', 'note', 'productId', 'startedOn'].sort());
  // 効き目・点数を持つ項目を作らない
  for (const key of Object.keys(empty)) assert.doesNotMatch(key, /effect|score|rating|good/i);
  assert.equal(isRegistered(empty), false);
  assert.equal(isRegistered({ name: 'x', startedOn: '2026-09-01' }), true);
  assert.equal(isRegistered({ name: 'x', startedOn: '' }), false, '始めた日が無ければ登録扱いにしない');
});

test('壊れた登録でも画面が落ちない形にそろう', () => {
  const p = normalizeProbiotic({ name: 123, startedOn: '2026-9-1', note: null, productId: 7 });
  assert.equal(p.name, '');
  assert.equal(p.startedOn, '', '日付の形が違えば捨てる（勝手に直さない）');
  assert.equal(p.note, '');
  assert.deepEqual(normalizeProbiotic(null), emptyProbiotic());
});

test('試している期間は通算で数える（連続日数を数えない）', () => {
  const days = {
    '2026-08-20': normalizeDay({ date: '2026-08-20', probiotic: true }),
    '2026-08-21': normalizeDay({ date: '2026-08-21' }), // 飲めなかった日
    '2026-08-22': normalizeDay({ date: '2026-08-22', probiotic: true }),
  };
  const probiotic = { name: '新ビオフェルミンS', productId: 'biofermin', startedOn: '2026-08-20', note: '' };
  const p = trialProgress(probiotic, days, '2026-08-22');
  assert.equal(p.known, true);
  assert.equal(p.elapsed, 3);
  assert.equal(p.takenDays, 2, '間が空いても通算で数える');
  assert.equal(p.reached, false);
  assert.equal(p.target, TRIAL_DAYS);
  assert.equal(TRIAL_DAYS, 30);
  // 連続日数を返さない
  assert.equal(Object.keys(p).some((k) => /streak|renzoku/i.test(k)), false);
  assert.doesNotMatch(codeOf('lib/probiotic.js'), /streak/i);
});

test('期間が来ても、どうするかはアプリが決めない', () => {
  const probiotic = { name: 'x', productId: 'biofermin', startedOn: '2026-08-01', note: '' };
  const done = trialProgress(probiotic, {}, '2026-09-02');
  assert.equal(done.reached, true);
  const line = trialLine(done);
  assert.match(line, /決める頃です/);
  assert.match(line, /ご自分で決めてください/);
  for (const bad of [/替えましょう/, /やめましょう/, /効いています/, /効いていません/]) {
    assert.doesNotMatch(line, bad, String(bad));
  }
  // 飲めなかった日を責めない
  assert.doesNotMatch(trialLine(trialProgress(probiotic, {}, '2026-08-05')), /さぼ|怠|守れ/);
  assert.match(trialLine({ known: false }), /登録すると/);
});

test('商品を勧めない・順位を付けない', () => {
  assert.ok(PRODUCTS.length >= 3);
  for (const p of PRODUCTS) {
    assert.ok(p.bacteria.length >= 1, p.id);
    assert.ok(p.forms.length >= 1, p.id);
    // おすすめ・値段・順位を持たない
    for (const key of Object.keys(p)) assert.doesNotMatch(key, /price|rank|best|recommend/i);
    assert.doesNotMatch(p.note, /いちばん|最強|おすすめです/);
  }
  const screen = codeOf('components/Probiotics.jsx');
  assert.match(screen, /このアプリはどれかを勧めません/);
  // 並べ替え（＝順位付け）をしていないこと。文言の打ち消しではなく、処理の不在で見る
  assert.doesNotMatch(screen, /PRODUCTS[\s\S]{0,40}\.sort\(/);
  assert.doesNotMatch(codeOf('lib/probiotic.js'), /\.sort\(/);
  // 次に試す候補は「今のもの以外」を並べるだけ
  // 出典が増えても順番を作らない：**元の並びのまま「今のもの以外」を返すだけ**
  assert.deepEqual(
    othersThan('biofermin', PRODUCTS).map((p) => p.id),
    PRODUCTS.filter((p) => p.id !== 'biofermin').map((p) => p.id),
  );
});

test('出典の誤りをそのまま通さない（整腸剤は食品ではない）', () => {
  const ids = PROBIOTIC_CORRECTIONS.map((c) => c.id);
  assert.ok(ids.includes('not_food'));
  const notFood = PROBIOTIC_CORRECTIONS.find((c) => c.id === 'not_food');
  assert.match(notFood.correction, /指定医薬部外品/);
  assert.match(notFood.correction, /食品ではありません/);
  assert.match(notFood.correction, /用法・用量/);
  for (const c of PROBIOTIC_CORRECTIONS) assert.ok(c.title && c.reading, c.id);
  // 画面にも必ず出す
  assert.match(codeOf('components/Probiotics.jsx'), /PROBIOTIC_CORRECTIONS/);
});

test('裏が取れていない主張を隠さず持ち、効き目を断定しない', () => {
  assert.ok(PROBIOTIC_UNVERIFIED.length >= 7);
  for (const item of PROBIOTIC_UNVERIFIED) {
    assert.ok(item.claim && item.note && item.title && item.reading, item.id);
    assert.match(
      item.note,
      /確かめ|たどれて|言い切れ|言えません|語れません|別のこと|変わります|決めないで|相談してください/,
      item.id,
    );
  }
  // 大学の名前で語られている数字を、アプリの言葉として持たない
  const screen = codeOf('components/Probiotics.jsx');
  for (const bad of [/ハーバード/, /コーネル/, /ニューヨーク州立/, /\d+%の人が(改善|治)/]) {
    assert.doesNotMatch(screen, bad, String(bad));
  }
  // 心の不調は様子見にしない
  const mental = PROBIOTIC_UNVERIFIED.find((i) => i.id === 'mental');
  assert.match(mental.note, /医療機関に相談/);
  // リーキーガットは確立した病名ではない、と書く
  const leaky = PROBIOTIC_UNVERIFIED.find((i) => i.id === 'leaky');
  assert.match(leaky.note, /確立した病名ではありません/);
});

test('受診の目安を弱めない・飲み合わせを調べない', () => {
  const screen = codeOf('components/Probiotics.jsx');
  assert.match(screen, /受診が遅れないように/);
  assert.match(screen, /onGo\('redflags'/);
  assert.match(NO_INTERACTION_CHECK, /飲み合わせを調べません/);
  assert.match(NO_INTERACTION_CHECK, /薬剤師/);
  // 飲み合わせの判定ロジックを持たない（MVP.md で「作らない」と決めた線）
  assert.doesNotMatch(codeOf('lib/probiotic.js'), /interaction|飲み合わせを(見|判定)/);
});

test('はじめる前の確認に、菌そのものが差しさわりになる人が入っている', () => {
  const ids = PROBIOTIC_PRECHECKS.map((p) => p.id);
  for (const need of ['immune', 'serious', 'catheter', 'antibiotics', 'baby']) {
    assert.ok(ids.includes(need), need);
  }
  assert.equal(PROBIOTIC_FAQ.length, 3);
  const howmany = PROBIOTIC_FAQ.find((f) => f.id === 'howmany');
  assert.match(howmany.a, /用法・用量/, '「1日1回でよい」だけで終わらせない');
});

test('出典に URL を書かない・最終確認日を持つ（整腸剤・調味料とも）', () => {
  for (const source of [PROBIOTIC_SOURCE, SEASONING_SOURCE]) {
    assert.doesNotMatch(source.text, /https?:|www\./);
    assert.match(source.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(source.check, true);
  }
  assert.doesNotMatch(src('data/probiotics.js'), /https?:\/\//);
  assert.doesNotMatch(src('data/seasonings.js'), /https?:\/\//);
  assert.match(TRIAL_NOTE, /※要確認/);
});

test('調味料は7つ・「見るところ」を必ず持つ', () => {
  assert.equal(SEASONINGS.length, 7);
  assert.equal(SEASONINGS.map((s) => s.aka).join(''), 'さしすせそ＋＋');
  for (const item of SEASONINGS) {
    assert.ok(item.choose, item.id);
    assert.ok(item.look, `${item.id} に「表示のどこを見るか」がない`);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.id);
  }
  assert.deepEqual(SEASONING_CHOICES.map((c) => c.id), ['changed', 'keep', 'later']);
});

test('調味料で値段の話をしない・替えた数を採点しない・断定しない', () => {
  const screen = codeOf('components/Seasonings.jsx');
  const data = codeOf('data/seasonings.js');
  for (const bad of [/高い|安い|値段|円/, /本物は高/]) {
    assert.doesNotMatch(screen, bad, String(bad));
    assert.doesNotMatch(data, bad, String(bad));
  }
  assert.match(SEASONING_PARTIAL_OK, /全部いっぺんに替えなくて/);
  assert.match(SEASONING_PARTIAL_OK, /採点しません/);
  // 添加物＝悪と決めつけない
  assert.match(SEASONING_AVOID.note, /言い切れるものではありません/);
  assert.ok(SEASONING_AVOID.reading);
});

test('目次から整腸剤・調味料のすべてに辿り着ける', () => {
  const entries = buildTocEntries();
  const titles = new Set(entries.map((e) => e.title));
  for (const b of BACTERIA) assert.ok(titles.has(b.name), b.name);
  for (const p of PRODUCTS) assert.ok(titles.has(p.name), p.name);
  for (const c of PROBIOTIC_UNVERIFIED) assert.ok(titles.has(c.title), c.title);
  for (const c of PROBIOTIC_CORRECTIONS) assert.ok(titles.has(c.title), c.title);
  for (const s of SEASONINGS) assert.ok(titles.has(`${s.title}の選び方`), s.title);
  assert.ok(titles.has(SEASONING_AVOID.title));
  for (const term of ['整腸剤', '酪酸菌', '芽胞（がほう）', 'まず1か月ためす', 'さしすせそ', '本みりん', '丸大豆', '天然醸造・静置発酵']) {
    assert.ok(titles.has(term), term);
  }
  // 「塩」「酢」は低FODMAP の一覧にもあるので、選び方は別の題にして落ちないようにする
  assert.ok(titles.has('塩の選び方'));
  assert.ok(titles.has('酢の選び方'));
  const care = entries.filter((e) => e.group === 'care');
  assert.ok(care.length >= 28);
  // 別名からも引ける（「塩」で「塩の選び方」へ）
  const saltEntry = entries.find((e) => e.title === '塩の選び方');
  assert.deepEqual(saltEntry.aliases.map((a) => a.name), ['塩']);
});
