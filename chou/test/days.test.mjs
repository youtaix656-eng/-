import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyDay,
  normalizeDay,
  normalizeDays,
  hasRecord,
  recordedKeys,
  flagMarksOf,
  splitFoods,
  foodsOfDay,
} from '../src/lib/days.js';

test('壊れた記録を渡しても画面が落ちない形にそろう', () => {
  const day = normalizeDay({
    date: '2026-09-02',
    belly: 'そんな段はない',
    pain: 42,
    stools: [null, 'ごみ', { bristol: 99 }, { bristol: 6, marks: ['blood', 'にせもの'] }],
    meals: [{ text: '   ' }, { text: 'パン' }, 7],
    note: 7,
  });
  assert.equal(day.belly, null);
  assert.equal(day.pain, null);
  assert.equal(day.stools.length, 2);
  assert.equal(day.stools[0].bristol, null); // 範囲外は捨てる（勝手に丸めない）
  assert.deepEqual(day.stools[1].marks, ['blood']); // 知らない印は落とす
  assert.equal(day.meals.length, 1);
  assert.equal(day.note, '');
});

test('日付が無い・形が違うものは取り込まない', () => {
  assert.equal(normalizeDay(null), null);
  assert.equal(normalizeDay({ date: '2026-9-2' }), null);
  assert.deepEqual(normalizeDays({ x: { date: 'こわれた' }, '2026-09-02': { date: '2026-09-02' } }), {
    '2026-09-02': normalizeDay({ date: '2026-09-02' }),
  });
});

test('「記録した日」の定義（どれか1つでも入っていればよい）', () => {
  const base = emptyDay('2026-09-02');
  assert.equal(hasRecord(base), false);
  assert.equal(hasRecord({ ...base, belly: 'usual' }), true);
  assert.equal(hasRecord({ ...base, note: 'ひとこと' }), true);
  assert.equal(hasRecord({ ...base, stools: [{ id: 's', bristol: 4, marks: [] }] }), true);
  // 「なし」を選んだだけでは記録した日にしない（押していないのと区別が付かないため）
  assert.equal(hasRecord({ ...base, pain: 'none' }), false);
  assert.equal(hasRecord({ ...base, pain: 'some' }), true);
});

test('記録した日は古い順に並ぶ', () => {
  const days = normalizeDays({
    '2026-09-03': { date: '2026-09-03', belly: 'easy' },
    '2026-09-01': { date: '2026-09-01', belly: 'hard' },
    '2026-09-02': { date: '2026-09-02' }, // 空なので数えない
  });
  assert.deepEqual(recordedKeys(days), ['2026-09-01', '2026-09-03']);
});

test('受診の目安に載っている印だけを拾う（判定はしない）', () => {
  const day = normalizeDay({
    date: '2026-09-02',
    stools: [
      { bristol: 6, marks: ['urgent'] },
      { bristol: 7, marks: ['blood', 'urgent'] },
      { bristol: 7, marks: ['blood'] },
    ],
  });
  assert.deepEqual(flagMarksOf(day), ['blood']); // urgent は目安の項目ではない・重複は1つ
  assert.deepEqual(flagMarksOf(null), []);
});

test('食べたもののざっくり分け（拾えないものがあることを前提にする）', () => {
  assert.deepEqual(splitFoods('ヨーグルト、パン'), ['ヨーグルト', 'パン']);
  assert.deepEqual(splitFoods('うどん うどん'), ['うどん']); // 1日の中の重複は1つ
  assert.deepEqual(splitFoods('米'), []); // 1文字は拾わない（誤って数えないため）
  assert.deepEqual(splitFoods(null), []);
});

test('1日の中で同じものが何度出ても1回', () => {
  const day = normalizeDay({
    date: '2026-09-02',
    meals: [{ text: 'パン、ヨーグルト' }, { text: 'パン' }],
  });
  assert.deepEqual(foodsOfDay(day).sort(), ['パン', 'ヨーグルト']);
});
