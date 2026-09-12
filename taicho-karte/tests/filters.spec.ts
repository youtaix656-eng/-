import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caresForSymptom, filterCares, filterSymptoms, sortCares, sortSymptoms } from '../src/lib/filters.js';
import { regionLabel } from '../src/data/bodyRegions.js';
import { care, DAY, NOW, symptom } from './fixtures.js';

const list = [
  symptom({ id: 'a', at: NOW - 3 * DAY, regionId: 'lower_back', vas: 7, note: '硬結あり' }),
  symptom({ id: 'b', at: NOW - 1 * DAY, regionId: 'shoulder_front_l', side: 'left', vas: 3 }),
  symptom({ id: 'c', at: NOW, regionId: 'knee_r', side: 'right', vas: 5, timing: 'other', timingOther: '運転後' }),
];

test('部位で絞る（左右をまとめて渡す）', () => {
  const r = filterSymptoms(list, { regionIds: ['knee_l', 'knee_r'] }, regionLabel);
  assert.deepEqual(r.map((s) => s.id), ['c']);
});

test('日付の範囲は両端を含む', () => {
  const from = '2026-09-11';
  const to = '2026-09-12';
  const r = filterSymptoms(list, { from, to }, regionLabel);
  assert.deepEqual(r.map((s) => s.id).sort(), ['b', 'c']);
  assert.equal(filterSymptoms(list, { from: '', to: '' }, regionLabel).length, 3);
});

test('VAS の下限とメモ・部位名・タイミングの部分一致', () => {
  assert.deepEqual(filterSymptoms(list, { minVas: 5 }, regionLabel).map((s) => s.id).sort(), ['a', 'c']);
  assert.deepEqual(filterSymptoms(list, { text: '硬結' }, regionLabel).map((s) => s.id), ['a']);
  assert.deepEqual(filterSymptoms(list, { text: '肩' }, regionLabel).map((s) => s.id), ['b']);
  assert.deepEqual(filterSymptoms(list, { text: '運転' }, regionLabel).map((s) => s.id), ['c']);
});

test('並び替え：新しい順・古い順・強い順', () => {
  assert.deepEqual(sortSymptoms(list, 'newest').map((s) => s.id), ['c', 'b', 'a']);
  assert.deepEqual(sortSymptoms(list, 'oldest').map((s) => s.id), ['a', 'b', 'c']);
  assert.deepEqual(sortSymptoms(list, 'vas_desc').map((s) => s.id), ['a', 'c', 'b']);
  // 元の配列は変えない
  assert.equal(list[0].id, 'a');
});

const cares = [
  care({ id: 'k1', at: NOW - 2 * DAY, date: '2026-09-10', effect: 'same', content: 'ストレッチ', symptomIds: ['a'] }),
  care({ id: 'k2', at: NOW - 1 * DAY, date: '2026-09-11', effect: 'much_better', content: '温める', symptomIds: ['a', 'b'] }),
  care({ id: 'k3', at: NOW, date: '2026-09-12', effect: 'worse', content: '体幹トレーニング', symptomIds: [] }),
  care({ id: 'k4', at: NOW - 3 * DAY, date: '2026-09-09', effect: 'better', content: 'ストレッチ 長め', symptomIds: ['c'] }),
];

test('対応策は「効果があった順」で並べられる（同じ効果は新しい順）', () => {
  assert.deepEqual(sortCares(cares, 'effect').map((c) => c.id), ['k2', 'k4', 'k1', 'k3']);
  assert.deepEqual(sortCares(cares, 'newest').map((c) => c.id), ['k3', 'k2', 'k1', 'k4']);
  assert.deepEqual(sortCares(cares, 'oldest').map((c) => c.id), ['k4', 'k1', 'k2', 'k3']);
});

test('対応策の絞り込み：効果・症状・内容・日付', () => {
  assert.deepEqual(filterCares(cares, { effects: ['better', 'much_better'] }).map((c) => c.id).sort(), ['k2', 'k4']);
  assert.deepEqual(filterCares(cares, { symptomId: 'a' }).map((c) => c.id).sort(), ['k1', 'k2']);
  assert.deepEqual(filterCares(cares, { text: 'ストレッチ' }).map((c) => c.id).sort(), ['k1', 'k4']);
  assert.deepEqual(filterCares(cares, { from: '2026-09-11', to: '2026-09-11' }).map((c) => c.id), ['k2']);
});

test('症状に紐づく対応策（新しい順）', () => {
  assert.deepEqual(caresForSymptom(cares, 'a').map((c) => c.id), ['k2', 'k1']);
  assert.deepEqual(caresForSymptom(cares, 'zzz'), []);
});
