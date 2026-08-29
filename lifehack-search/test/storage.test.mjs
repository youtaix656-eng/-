import test from 'node:test';
import assert from 'node:assert/strict';

import { EMPTY, HISTORY_LIMIT, normalize, pushHistory, save, load, clear, storageSize } from '../src/lib/storage.js';

// 端末内保存だけを見るための、ごく小さな置き換え
function fakeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('壊れた保存・古い保存でも落ちない（形をそろえて返す）', () => {
  assert.deepEqual(normalize({}), EMPTY);
  assert.deepEqual(normalize({ favorites: 'こわれている' }).favorites, []);
  assert.deepEqual(normalize({ favorites: ['a', 1, null] }).favorites, ['a']);
  assert.equal(normalize({ settings: { showBasis: false } }).settings.effortMax, EMPTY.settings.effortMax);
});

test('検索の履歴は、同じ語を重ねず上へ寄せる・上限で切る', () => {
  let history = [];
  history = pushHistory(history, '睡眠');
  history = pushHistory(history, '片づけ');
  history = pushHistory(history, '睡眠');
  assert.deepEqual(history.map((h) => h.q), ['睡眠', '片づけ']);
  for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) history = pushHistory(history, `語${i}`);
  assert.equal(history.length, HISTORY_LIMIT);
  assert.equal(pushHistory(history, '   ').length, HISTORY_LIMIT, '空白だけは足さない');
});

test('履歴は押した語をそのまま持つ（正規化して持つと入れ直した時に入力が変わる）', () => {
  const history = pushHistory([], 'スマホ 通知');
  assert.equal(history[0].q, 'スマホ 通知');
});

test('保存して読み直せる（端末内のみ）', () => {
  globalThis.localStorage = fakeLocalStorage();
  clear();
  assert.deepEqual(load(), EMPTY);
  save({ ...EMPTY, favorites: ['time-2min'], tried: { 'time-2min': { status: 'doing', at: 1 } } });
  const state = load();
  assert.deepEqual(state.favorites, ['time-2min']);
  assert.equal(state.tried['time-2min'].status, 'doing');
  assert.ok(storageSize() > 0);
  clear();
  assert.deepEqual(load(), EMPTY);
  delete globalThis.localStorage;
});
