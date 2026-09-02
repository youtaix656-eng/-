import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCOPES, SLOTS, keyFor, normalizeThree, getThree, isWritten, filledCount, writtenDays,
  carryDown, firstEmptySlot, splitFocusText,
} from '../src/lib/threeRules.js';

test('日・週・月で同じ仕組みを使う（キーだけ変える）', () => {
  assert.equal(SCOPES.length, 3);
  assert.equal(keyFor('day', '2026-08-30'), '2026-08-30');
  assert.equal(keyFor('week', '2026-08-30'), 'w:2026-08-24'); // 8/30は日曜 → 週頭は8/24
  assert.equal(keyFor('month', '2026-08-30'), 'm:2026-08');
  // 同じ週のどの日から呼んでも同じキーになる
  assert.equal(keyFor('week', '2026-08-24'), keyFor('week', '2026-08-30'));
});

test('常に3枠にそろえる', () => {
  assert.deepEqual(normalizeThree(undefined), ['', '', '']);
  assert.deepEqual(normalizeThree(['a']), ['a', '', '']);
  assert.deepEqual(normalizeThree(['a', 'b', 'c', 'd']), ['a', 'b', 'c']);
  assert.equal(normalizeThree(['あ'.repeat(100)])[0].length, 60);
  assert.equal(SLOTS, 3);
});

test('1つでも書けていれば「書いた」（3つ埋めることを条件にしない）', () => {
  assert.equal(isWritten(undefined), false);
  assert.equal(isWritten(['', '', '']), false);
  assert.equal(isWritten(['  ', '', '']), false);
  assert.equal(isWritten(['過去問20問', '', '']), true);
  assert.equal(filledCount(['a', '', 'c']), 2);
});

test('保存された表から読み出す', () => {
  const store = { '2026-08-30': ['過去問', '', ''], 'w:2026-08-24': ['模試'] };
  assert.deepEqual(getThree(store, 'day', '2026-08-30'), ['過去問', '', '']);
  assert.deepEqual(getThree(store, 'week', '2026-08-30'), ['模試', '', '']);
  assert.deepEqual(getThree(store, 'month', '2026-08-30'), ['', '', '']);
  assert.deepEqual(getThree(undefined, 'day', '2026-08-30'), ['', '', '']);
});

test('期間内に「今日の3つ」を書けた日数', () => {
  const store = { '2026-08-24': ['a'], '2026-08-25': ['', '', ''], '2026-08-26': ['b', 'c'] };
  assert.equal(writtenDays(store, ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27']), 2);
  assert.equal(writtenDays(undefined, ['2026-08-24']), 0);
});

test('上の階層から降ろす。すでに入っているものは重複させない', () => {
  assert.deepEqual(carryDown(['模試を受ける', '過去問20問', ''], ['過去問20問', '', '']), ['模試を受ける']);
  assert.deepEqual(carryDown(['a', 'b', 'c'], ['', '', '']), ['a', 'b', 'c']);
  assert.deepEqual(carryDown(undefined, ['a']), []);
  assert.deepEqual(carryDown(['  ', ''], ['']), []);
});

test('空いている枠を探す', () => {
  assert.equal(firstEmptySlot(['a', '', 'c']), 1);
  assert.equal(firstEmptySlot(['a', 'b', 'c']), -1);
  assert.equal(firstEmptySlot(undefined), 0);
});

test('週次振り返りの自由記述を3つに割る（引き継ぎの入口）', () => {
  assert.deepEqual(splitFocusText('過去問を20問\n模試の復習\n早寝'), ['過去問を20問', '模試の復習', '早寝']);
  assert.deepEqual(splitFocusText('・過去問\n・模試'), ['過去問', '模試']);
  assert.deepEqual(splitFocusText('a、b、c、d'), ['a', 'b', 'c']);
  assert.deepEqual(splitFocusText(''), []);
});
