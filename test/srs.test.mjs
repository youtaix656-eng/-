import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  applyAnswer,
  applyGrade,
  isInReview,
  isDue,
  sortByPriority,
  normalize,
  GRADES,
  MATURE_INTERVAL,
} from '../src/lib/srs.js';

const DAY = 24 * 60 * 60 * 1000;

test('初期状態は復習対象でない', () => {
  const s = emptyState();
  assert.equal(isInReview(s), false);
});

test('誤答すると復習対象になり、翌日出題', () => {
  const now = 1_000_000_000_000;
  const s = applyAnswer(emptyState(), false, now);
  assert.equal(s.interval, 1);
  assert.equal(s.wrongCount, 1);
  assert.equal(isInReview(s), true);
  assert.equal(s.due, now + 1 * DAY);
});

test('正解を重ねると間隔が延びていく（1→6→…）', () => {
  const now = 1_000_000_000_000;
  let s = applyAnswer(emptyState(), false, now); // まず誤答して復習対象に
  s = applyGrade(s, GRADES.good, now); // 1回目正解
  assert.equal(s.interval, 1);
  s = applyGrade(s, GRADES.good, now); // 2回目正解
  assert.equal(s.interval, 6);
  const prev = s.interval;
  s = applyGrade(s, GRADES.good, now); // 3回目 → interval*ef
  assert.ok(s.interval > prev);
});

test('「かんたん」は「ふつう」より EF が上がる', () => {
  const now = 1_000_000_000_000;
  const base = applyGrade(emptyState(), GRADES.good, now);
  const easy = applyGrade(emptyState(), GRADES.easy, now);
  assert.ok(easy.ef > base.ef);
});

test('EF は下限 1.3 を下回らない', () => {
  let s = emptyState();
  const now = 1_000_000_000_000;
  for (let i = 0; i < 10; i++) s = applyGrade(s, GRADES.hard, now);
  assert.ok(s.ef >= 1.3);
});

test('十分に定着（interval >= MATURE）すると復習対象から外れる', () => {
  const s = { ...emptyState(), wrongCount: 1, interval: MATURE_INTERVAL };
  assert.equal(isInReview(s), false);
});

test('期限判定 isDue', () => {
  const now = 1_000_000_000_000;
  const s = { ...emptyState(), due: now - 1000 };
  assert.equal(isDue(s, now), true);
  const future = { ...emptyState(), due: now + DAY };
  assert.equal(isDue(future, now), false);
});

test('旧 Leitner 形式(box) を SM-2 形式へ移行できる', () => {
  const legacy = { box: 2, due: 123, wrongCount: 1, seen: 3 };
  const s = normalize(legacy);
  assert.ok(s.ef >= 1.3);
  assert.equal(typeof s.interval, 'number');
  assert.equal(s.wrongCount, 1);
});

test('優先度ソート: 期限切れが先に来る', () => {
  const now = 1_000_000_000_000;
  const qs = [
    { id: 'later' },
    { id: 'overdue' },
  ];
  const srs = {
    later: { ...emptyState(), due: now + 5 * DAY, interval: 5 },
    overdue: { ...emptyState(), due: now - 2 * DAY, interval: 1 },
  };
  const sorted = sortByPriority(qs, srs, now);
  assert.equal(sorted[0].id, 'overdue');
});

test('applyAnswer(正解) は grade=good として扱われる', () => {
  const now = 1_000_000_000_000;
  const a = applyAnswer(emptyState(), true, now);
  const b = applyGrade(emptyState(), GRADES.good, now);
  assert.equal(a.interval, b.interval);
  assert.equal(a.ef, b.ef);
});
