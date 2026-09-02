import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SPEED_CLASSES,
  SPEED_NAMED,
  SPEED_BASIS_LABELS,
  BAD_PAIRS,
  OLIVE_OIL_TIP,
  MEAL_GAP_HOURS,
  MEAL_GAP_NOTE,
  ADAMSKI_UNVERIFIED,
  ADAMSKI_PRECHECKS,
  ADAMSKI_PARTIAL_OK,
  ADAMSKI_SOURCE,
  THREE_CAUSES,
} from '../src/data/adamski.js';
import {
  speedOf,
  findSpeedIn,
  checkCombination,
  checkDay,
  mealGaps,
  morningCheck,
  speedLabel,
} from '../src/lib/combine.js';
import { conflictFoods, conflictOf, CONFLICT_NOTE, onlyInAdamski } from '../src/lib/conflicts.js';
import { normalizeDay } from '../src/lib/days.js';
import { lifeCounts } from '../src/lib/stats.js';
import { buildVisitNote, NOTE_PARTS } from '../src/lib/visitNote.js';
import { buildTocEntries } from '../src/data/toc.js';
import { FODMAP_FOODS } from '../src/data/fodmap.js';
import { EXERCISE_STEPS, LEVELS } from '../src/data/scales.js';

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const codeOf = (path) =>
  src(path)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

test('速さは出どころ（named／category／default／unknown）を必ず一緒に返す', () => {
  assert.deepEqual(speedOf('トマト'), { name: 'トマト', speed: 'fast', basis: 'named' });
  assert.deepEqual(speedOf('りんご'), { name: 'りんご', speed: 'fast', basis: 'category' });
  assert.deepEqual(speedOf('にんじん'), { name: 'にんじん', speed: 'slow', basis: 'default' });
  assert.deepEqual(speedOf('しらない食べもの'), { name: 'しらない食べもの', speed: null, basis: 'unknown' });
  assert.deepEqual(speedOf(''), { name: '', speed: null, basis: 'unknown' });
  // 当てはめたものと名指しを同じ顔で見せない（言い方が4つとも用意されている）
  for (const basis of ['named', 'category', 'default', 'unknown']) {
    assert.ok(SPEED_BASIS_LABELS[basis], basis);
  }
});

test('名指しは区分より強い（ヨーグルトは「速い」）', () => {
  // ヨーグルトは低FODMAP では乳製品（＝当てはめると「遅い」）だが、出典が名指ししている
  assert.equal(speedOf('ヨーグルト').speed, 'fast');
  assert.equal(speedOf('ヨーグルト').basis, 'named');
});

test('組み合わせは数えるだけ（よい・悪いを返さない）', () => {
  const r = checkCombination(['トマト', 'パスタ（小麦）', 'オリーブ油']);
  assert.equal(r.mixed, true);
  assert.equal(r.counts.fast, 1);
  assert.equal(r.counts.slow, 1);
  assert.equal(r.counts.neutral, 1);
  assert.equal(r.hasNeutral, true);
  // 「よい」「悪い」「危険」といった判定語を返り値に持たない
  assert.equal(Object.keys(r).some((k) => /good|bad|risk|score|danger/i.test(k)), false);

  const same = checkCombination(['白米', '魚']);
  assert.equal(same.mixed, false);

  const empty = checkCombination([]);
  assert.equal(empty.mixed, false);
  assert.deepEqual(empty.items, []);
  assert.deepEqual(checkCombination(null).items, []);
});

test('当てはめただけのものと、出典に無いものを数えて見せる', () => {
  const r = checkCombination(['りんご', 'にんじん', 'なぞの食材']);
  assert.equal(r.guessed, 2, '区分・既定から当てはめたものは数える');
  assert.deepEqual(r.unknown, ['なぞの食材']);
  assert.equal(r.counts.unknown, 1);
});

test('文からも当てる（当たった語を返す）', () => {
  const hits = findSpeedIn('トマトソースのパスタ');
  const names = hits.map((h) => h.name);
  assert.ok(names.includes('トマト'), 'トマトに当たる');
  assert.ok(names.includes('パスタ（小麦）'), '注記つきの見出しでも当たる');
  assert.deepEqual(findSpeedIn(''), []);
  // 同じ語に二度当てない（「メロン」で名指しと一覧の両方が並ばない。実機で出た）
  const melon = findSpeedIn('生ハムメロン');
  assert.equal(melon.filter((h) => h.matched === 'メロン').length, 1);
  assert.deepEqual(melon.map((h) => h.name).sort(), ['メロン', '生ハム'].sort());
});

test('1日の食事ごとに見る（記録から）', () => {
  const day = normalizeDay({
    date: '2026-09-02',
    meals: [
      { at: '08:00', text: 'ヨーグルト、いちご' },
      { at: '12:30', text: 'トマト、パスタ（小麦）' },
    ],
  });
  const rows = checkDay(day);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].result.mixed, false, '速いものどうしは混ざりにならない');
  assert.equal(rows[1].result.mixed, true);
  assert.deepEqual(checkDay(null), []);
});

test('食事の間隔は時刻のある記録だけで数え、数えなかった件数も返す', () => {
  const day = normalizeDay({
    date: '2026-09-02',
    meals: [
      { at: '08:00', text: 'パン' },
      { at: '13:00', text: '米' },
      { at: '15:00', text: 'ナッツ' },
      { at: '', text: '時刻なし' },
    ],
  });
  const { gaps, skipped, guideHours } = mealGaps(day);
  assert.equal(guideHours, MEAL_GAP_HOURS);
  assert.equal(skipped, 1, '時刻の無い記録は黙って捨てず、数えて返す');
  assert.deepEqual(gaps.map((g) => g.minutes), [300, 120]);
  assert.deepEqual(gaps.map((g) => g.reachesGuide), [true, false]);
  // 記録が1件以下なら間隔は出さない（0と書かない）
  assert.deepEqual(mealGaps(normalizeDay({ date: '2026-09-02', meals: [{ at: '08:00', text: 'パン' }] })).gaps, []);
});

test('朝の軽さは、時刻が無ければ判定しない', () => {
  const noTime = morningCheck(normalizeDay({ date: '2026-09-02', meals: [{ text: 'パン' }] }));
  assert.equal(noTime.known, false);
  assert.match(noTime.reason, /時刻/);

  const light = morningCheck(
    normalizeDay({ date: '2026-09-02', meals: [{ at: '07:30', text: 'いちご、ヨーグルト' }, { at: '12:00', text: '米' }] }),
  );
  assert.equal(light.known, true);
  assert.equal(light.at, '07:30');
  assert.equal(light.lightOnly, true);

  const heavy = morningCheck(normalizeDay({ date: '2026-09-02', meals: [{ at: '07:30', text: 'パン、ヨーグルト' }] }));
  assert.equal(heavy.lightOnly, false);
});

test('低FODMAP と反対になるものを、元データから導く（書き写さない）', () => {
  const clashes = conflictFoods();
  assert.deepEqual(
    clashes.map((c) => c.name).sort(),
    ['たまねぎ', 'にんにく', 'はちみつ', 'ヨーグルト', '牛乳'].sort(),
  );
  for (const c of clashes) {
    assert.equal(c.lines.length, 2, '両方の言い分を並べる');
    assert.match(c.lines[0], /低FODMAP/);
    assert.match(c.lines[1], /アダムスキー/);
  }
  assert.equal(conflictOf('ヨーグルト').kind, 'fodmap_high_but_fast');
  assert.equal(conflictOf('たまねぎ').kind, 'fodmap_high_but_neutral');
  assert.equal(conflictOf('白米'), null);
  // 一覧を手で書き写していない証拠
  const code = codeOf('lib/conflicts.js');
  assert.match(code, /import \{ FODMAP_FOODS/);
  assert.doesNotMatch(code, /const CONFLICTS = \[/);
});

test('どちらが正しいかを決めない（食い違いの文言）', () => {
  assert.match(CONFLICT_NOTE, /どちらが正しいかを決めません/);
  assert.doesNotMatch(CONFLICT_NOTE, /正しいのは|おすすめは|こちらを選/);
  // 片方の見方しか無いもの（低FODMAP の一覧に無いもの）も黙らせない
  const only = onlyInAdamski();
  for (const need of ['パプリカ', '唐辛子', 'ピザ', 'パン', '米']) {
    assert.ok(only.includes(need), need);
  }
  const inFodmap = new Set(FODMAP_FOODS.map((f) => f.name));
  for (const name of only) assert.equal(inFodmap.has(name), false, name);
});

test('裏が取れていない主張を隠さず持ち、1件ずつ「確かめられていない」を添える', () => {
  assert.ok(ADAMSKI_UNVERIFIED.length >= 5);
  for (const item of ADAMSKI_UNVERIFIED) {
    assert.ok(item.claim, item.id);
    assert.match(item.note, /確かめ|変わります|さまざま/, `${item.id} に「確かめられていない」旨がない`);
    assert.ok(item.title && item.reading, `${item.id} に目次用の題と読みがない`);
  }
  // 出典の数字は「主張」として持ち、アプリの計算には使わない
  const code = codeOf('lib/combine.js');
  for (const bad of [/\b18\b/, /\b30\b/, /\b40\b/, /毒素/]) {
    assert.doesNotMatch(code, bad, `計算に出典の数字を持ち込まない: ${bad}`);
  }
  // 使ってよい数字は食事の間隔だけで、それも定数から取る
  assert.match(code, /MEAL_GAP_HOURS/);
  assert.equal(MEAL_GAP_HOURS, 4);
  assert.match(MEAL_GAP_NOTE, /出典/);
  assert.match(MEAL_GAP_NOTE, /※要確認/);
});

test('効果を断定しない・アプリが「詰まっている」と言わない', () => {
  const screen = codeOf('components/Combine.jsx');
  for (const bad of [/詰まっています/, /毒素が出ています/, /治ります/, /必ず[よ良]く/, /改善します/]) {
    assert.doesNotMatch(screen, bad, String(bad));
  }
  // 出すのは「この考え方では」まで
  assert.match(screen, /この考え方では/);
  assert.match(screen, /これは判定ではありません/);
});

test('誰にでも勧められる話ではない（はじめる前の確認）', () => {
  assert.ok(ADAMSKI_PRECHECKS.length >= 5);
  const ids = ADAMSKI_PRECHECKS.map((p) => p.id);
  for (const need of ['diabetes', 'pregnant', 'growing', 'eating', 'gallbladder']) {
    assert.ok(ids.includes(need), need);
  }
  // 油の一手には必ず注意を添える
  assert.match(OLIVE_OIL_TIP.caution, /相談/);
  assert.equal(OLIVE_OIL_TIP.check, true);
  assert.doesNotMatch(OLIVE_OIL_TIP.body, /効きます|治ります/);
});

test('守れた回数を数えない（できる範囲でよい）', () => {
  assert.match(ADAMSKI_PARTIAL_OK, /できる範囲/);
  assert.match(ADAMSKI_PARTIAL_OK, /数えません/);
  const code = codeOf('lib/combine.js');
  assert.doesNotMatch(code, /streak|連続\s*\d/i);
  // 画面にも必ず出す
  assert.match(codeOf('components/Combine.jsx'), /ADAMSKI_PARTIAL_OK/);
});

test('出典に URL を書かない・最終確認日を持つ', () => {
  assert.doesNotMatch(ADAMSKI_SOURCE.text, /https?:|www\./);
  assert.match(ADAMSKI_SOURCE.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(ADAMSKI_SOURCE.check, true);
  assert.doesNotMatch(src('data/adamski.js'), /https?:\/\//);
});

test('速さは3つだけ・点数や順位を付けない', () => {
  assert.deepEqual(SPEED_CLASSES.map((s) => s.id), ['fast', 'slow', 'neutral']);
  for (const cls of SPEED_CLASSES) {
    assert.doesNotMatch(cls.label, /良|悪|危険|おすすめ/);
    assert.match(cls.note, /出典|紹介/);
  }
  assert.equal(speedLabel('fast'), '速い');
  assert.equal(speedLabel(null), '出典に出てきません');
  assert.equal(SPEED_NAMED.length >= 30, true);
  // 読みは手で書く
  for (const food of SPEED_NAMED) assert.match(food.reading, /^[ぁ-んー]+$/, food.name);
});

test('よくない組み合わせの代表例は、速い側と遅い側を必ず書く', () => {
  assert.equal(BAD_PAIRS.length, 5);
  for (const pair of BAD_PAIRS) {
    assert.ok(pair.fast && pair.slow, pair.id);
    assert.match(pair.reading, /^[ぁ-んー]+$/);
  }
  assert.equal(THREE_CAUSES.length, 3);
});

test('ストレスと運動は日数で数える（平均を出さない）', () => {
  const days = {
    '2026-09-01': normalizeDay({ date: '2026-09-01', stress: 'strong', exercise: 'none' }),
    '2026-09-02': normalizeDay({ date: '2026-09-02', stress: 'some', exercise: 'much' }),
    '2026-09-03': normalizeDay({ date: '2026-09-03' }),
  };
  const keys = ['2026-09-01', '2026-09-02', '2026-09-03'];
  const life = lifeCounts(days, keys);
  assert.equal(life.stress.strong, 1);
  assert.equal(life.stress.some, 1);
  assert.equal(life.exercise.much, 1);
  assert.equal(life.exercise.none, 1);
  assert.equal(life.stressDays, 2);
  assert.equal(life.exerciseDays, 2);
  assert.doesNotMatch(codeOf('lib/stats.js'), /function\s+(average|mean)/i);
  // 段は増やさない（ストレスは痛み・張りと同じ4段）
  assert.equal(LEVELS.length, 4);
  assert.equal(EXERCISE_STEPS.length, 4);
});

test('受診メモにもストレス・運動を入れられる（入れないと出ない）', () => {
  const days = {
    '2026-09-01': normalizeDay({ date: '2026-09-01', stress: 'some', exercise: 'little' }),
  };
  const keys = ['2026-09-01', '2026-09-02'];
  assert.ok(NOTE_PARTS.some((p) => p.id === 'life'));
  const withLife = buildVisitNote(days, keys, ['life']);
  assert.match(withLife, /ストレス・体を動かしたか/);
  assert.match(withLife, /ストレス：ある 1日/);
  assert.match(withLife, /体を動かした：すこし動いた 1日/);
  const without = buildVisitNote(days, keys, []);
  assert.doesNotMatch(without, /ストレス・体を動かしたか/);
});

test('目次から食べ合わせのすべてに辿り着ける', () => {
  const entries = buildTocEntries();
  const titles = new Set(entries.map((e) => e.title));
  for (const pair of BAD_PAIRS) assert.ok(titles.has(pair.title), pair.title);
  for (const claim of ADAMSKI_UNVERIFIED) assert.ok(titles.has(claim.title), claim.title);
  for (const name of onlyInAdamski()) assert.ok(titles.has(name), name);
  for (const term of ['食べ合わせ（アダムスキー式）', '消化の速い食べもの', '消化の遅い食べもの', 'ニュートラルの食べもの', '2つの考え方が反対になるところ', 'オリーブオイルをひと口', '食事の間隔', '朝を軽くする', 'ストレスの記録', '体を動かした記録', 'できる範囲でよい']) {
    assert.ok(titles.has(term), term);
  }
  // 食べ合わせのまとまりが目次にある
  assert.ok(entries.filter((e) => e.group === 'combine').length >= 14);
  // 裏が取れていない主張は目次でも「※要確認」側に置く
  for (const entry of entries.filter((e) => e.id.startsWith('toc-unverified-'))) {
    assert.equal(entry.descriptionStatus, 'needs_review', entry.title);
  }
});

test('出典が挙げている代表例が、そのままの言い方で拾える', () => {
  // **実機で取りこぼした所。** 一覧の見出しを長い名前にしたせいで、
  // 出典がいちばん代表的な例として挙げている「トマト＋パスタ」が当たっていなかった。
  const cases = [
    [['トマト', 'パスタ'], true],
    [['生ハム', 'メロン'], true],
    [['フルーツ', '小麦粉', 'バター', '卵'], true],
    [['焼肉', 'くだもの'], true],
    [['パン', '肉'], false],
    [['米', '魚'], false],
    [['ヨーグルト', 'いちご'], false],
  ];
  for (const [words, expected] of cases) {
    assert.equal(checkCombination(words).mixed, expected, words.join('＋'));
    for (const w of words) {
      assert.notEqual(speedOf(w).basis, 'unknown', `${w} が出典に無い扱いになっている`);
    }
  }
  // 表記のゆれ（カタカナ／ひらがな）で取りこぼさない
  assert.equal(speedOf('ジャガイモ').speed, speedOf('じゃがいも').speed);
  assert.equal(speedOf('トウモロコシ').basis, 'named');
  assert.equal(speedOf('ヨーグルト').speed, speedOf('よーぐると').speed);
});
