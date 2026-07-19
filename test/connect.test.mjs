import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKey,
  hashStr,
  dailyPick,
  prevDateKey,
  nextStreak,
  keywordClusters,
  relatedPairs,
} from '../src/lib/connect.js';

test('dailyPick は同じ日・同じ母集団で常に同じ問題を返す', () => {
  const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const k = '2027-02-28';
  const p1 = dailyPick(pool, k);
  const p2 = dailyPick(pool, k);
  assert.equal(p1.id, p2.id);
});

test('dailyPick は日が変われば選び直す可能性がある（決定的）', () => {
  const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
  const picks = new Set();
  for (let d = 1; d <= 20; d++) {
    const key = `2027-01-${String(d).padStart(2, '0')}`;
    picks.add(dailyPick(pool, key).id);
  }
  // 20日で複数種類が選ばれる（1つに固定されない）
  assert.ok(picks.size >= 2);
});

test('dailyPick は空なら null', () => {
  assert.equal(dailyPick([], 'x'), null);
});

test('prevDateKey は前日を返す（月またぎ）', () => {
  assert.equal(prevDateKey('2027-03-01'), '2027-02-28');
  assert.equal(prevDateKey('2027-01-01'), '2026-12-31');
});

test('nextStreak: 初回は1', () => {
  assert.equal(nextStreak('', 0, '2027-02-10'), 1);
});
test('nextStreak: 前日に続けば+1', () => {
  assert.equal(nextStreak('2027-02-09', 3, '2027-02-10'), 4);
});
test('nextStreak: 同日2回目は据え置き', () => {
  assert.equal(nextStreak('2027-02-10', 3, '2027-02-10'), 3);
});
test('nextStreak: 間が空けば1にリセット', () => {
  assert.equal(nextStreak('2027-02-05', 9, '2027-02-10'), 1);
});

test('keywordClusters: キーワードで問題をまとめ、多い順に並ぶ', () => {
  const questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }];
  const links = {
    q1: { keywords: ['四総穴', '大腸経'] },
    q2: { keywords: ['四総穴'] },
    q3: { keywords: ['五行'] },
  };
  const cl = keywordClusters(questions, links);
  assert.equal(cl[0].keyword, '四総穴'); // 2問で最多
  assert.equal(cl[0].questionIds.length, 2);
});

test('relatedPairs: 双方向を重複なく1本にする', () => {
  const questions = [{ id: 'a' }, { id: 'b' }];
  const links = { a: { related: ['b'] }, b: { related: ['a'] } };
  const pairs = relatedPairs(questions, links);
  assert.equal(pairs.length, 1);
});

test('dateKey は YYYY-MM-DD 形式', () => {
  assert.match(dateKey(new Date(2027, 1, 3)), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(dateKey(new Date(2027, 1, 3)), '2027-02-03');
});
