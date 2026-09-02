import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDays } from '../src/lib/days.js';
import * as stats from '../src/lib/stats.js';
import { lastKeys } from '../src/lib/dates.js';

const days = normalizeDays({
  '2026-09-01': {
    date: '2026-09-01',
    belly: 'hard',
    stools: [{ bristol: 6, marks: ['urgent'] }, { bristol: 7, marks: [] }],
    meals: [{ text: 'ヨーグルト、パン' }],
  },
  '2026-09-02': {
    date: '2026-09-02',
    belly: 'very_hard',
    stools: [{ bristol: 1, marks: ['blood'] }],
    meals: [{ text: 'ヨーグルト' }],
    note: '会議の前から痛い',
  },
  '2026-09-03': { date: '2026-09-03', belly: 'usual', stools: [], meals: [{ text: 'うどん' }] },
});
const keys = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];

test('通算の記録日数（連続日数ではない）', () => {
  assert.equal(stats.recordedTotal(days), 3);
});

test('埋まり具合は、記録の無い日を false のまま残す', () => {
  const fill = stats.fillOf(days, keys);
  assert.equal(fill.done, 3);
  assert.equal(fill.total, 4);
  assert.deepEqual(fill.marks, [true, true, true, false]);
});

test('お腹の段は日数で数える（平均を出さない）', () => {
  const { counts, recorded } = stats.bellyCounts(days, keys);
  assert.equal(counts.hard, 1);
  assert.equal(counts.very_hard, 1);
  assert.equal(counts.usual, 1);
  assert.equal(counts.easy, 0);
  assert.equal(recorded, 3);
});

test('ブリストルは分布で出す（1と7の平均を4と言わない）', () => {
  const b = stats.bristolCounts(days, keys);
  assert.equal(b.total, 3);
  assert.equal(b.byNumber[6], 1);
  assert.equal(b.byNumber[7], 1);
  assert.equal(b.byNumber[1], 1);
  assert.equal(b.byGroup.firm, 1);
  assert.equal(b.byGroup.loose, 2);
  assert.equal(b.byGroup.middle, 0);
});

test('回数は幅で出す（記録した日だけを見る）', () => {
  const per = stats.stoolPerDay(days, keys);
  assert.deepEqual(per, { min: 0, max: 2, daysCounted: 3 });
  assert.equal(stats.stoolPerDay(days, ['2026-09-04']), null);
});

test('印は日数で数える（1日に2回付いても1日）', () => {
  const marks = stats.markDays(
    normalizeDays({
      '2026-09-01': {
        date: '2026-09-01',
        stools: [{ bristol: 6, marks: ['urgent'] }, { bristol: 7, marks: ['urgent'] }],
      },
    }),
    ['2026-09-01'],
  );
  assert.equal(marks.urgent, 1);
});

test('つらかった日（つらい・とてもつらい）', () => {
  assert.equal(stats.hardBellyDays(days, keys), 2);
});

test('1日しか出ていないものを「よく食べていたもの」に入れない', () => {
  const foods = stats.topFoods(days, keys);
  assert.deepEqual(foods, [{ food: 'ヨーグルト', days: 2 }]);
  assert.equal(stats.MIN_FOOD_DAYS, 2);
});

test('入力候補は1回だけのものも出す（数えるのとは別の用途）', () => {
  const suggestions = stats.foodSuggestions(days);
  assert.ok(suggestions.includes('うどん'));
  assert.equal(suggestions[0], 'ヨーグルト');
});

test('並びは記録の無い日を null のまま残す（間を詰めない）', () => {
  const rows = stats.series(days, keys);
  assert.equal(rows.length, 4);
  assert.equal(rows[3].bellyOrder, null);
  assert.equal(rows[3].recorded, false);
  assert.deepEqual(rows[0].stools, [6, 7]);
});

test('平均を返す関数を持たない（点数になるため）', () => {
  for (const name of Object.keys(stats)) {
    assert.ok(!/average|mean|score|streak/i.test(name), `${name} は持たない`);
  }
});

test('期間が空でも落ちない', () => {
  assert.deepEqual(stats.fillOf({}, []), { done: 0, total: 0, marks: [] });
  assert.deepEqual(stats.topFoods({}, lastKeys(14, '2026-09-02')), []);
});
