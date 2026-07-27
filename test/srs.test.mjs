import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  applyAnswer,
  applyGrade,
  isInReview,
  isMastered,
  isDue,
  sortByPriority,
  normalize,
  GRADES,
  MASTER_STREAK,
} from '../src/lib/srs.js';

const DAY = 24 * 60 * 60 * 1000;

test('初期状態は復習対象でない', () => {
  const s = emptyState();
  assert.equal(isInReview(s), false);
});

test('誤答(△✕)すると復習対象になり、約20分後に再出題・連続はリセット', () => {
  const now = 1_000_000_000_000;
  const s = applyGrade({ ...emptyState(), correctStreak: 2 }, GRADES.again, now);
  assert.equal(s.wrongCount, 1);
  assert.equal(s.correctStreak, 0); // 連続完璧がリセット
  assert.equal(isInReview(s), true);
  assert.equal(s.due, now + 20 * 60 * 1000); // 忘却曲線の初回＝約20分後
});

test('○(完璧)を重ねると忘却曲線に沿って間隔が延びる（1→3→7→16日）', () => {
  const now = 1_000_000_000_000;
  let s = applyGrade(emptyState(), GRADES.again, now); // まず誤答で復習対象へ
  s = applyGrade(s, GRADES.easy, now); // 1回目完璧
  assert.equal(s.interval, 1);
  s = applyGrade(s, GRADES.easy, now); // 2回目
  assert.equal(s.interval, 3);
  s = applyGrade(s, GRADES.easy, now); // 3回目
  assert.equal(s.interval, 7);
  s = applyGrade(s, GRADES.easy, now); // 4回目
  assert.equal(s.interval, 16);
});

test('△・✕で連続完璧がリセットされる', () => {
  const now = 1_000_000_000_000;
  let s = { ...emptyState(), wrongCount: 1, correctStreak: 3 };
  s = applyGrade(s, GRADES.again, now); // △/✕
  assert.equal(s.correctStreak, 0);
  assert.equal(isMastered(s), false);
});

test('EF は下限 1.3 を下回らない', () => {
  let s = emptyState();
  const now = 1_000_000_000_000;
  for (let i = 0; i < 10; i++) s = applyGrade(s, GRADES.hard, now);
  assert.ok(s.ef >= 1.3);
});

test('○(完璧)5回連続でマスターし、復習対象から外れる', () => {
  const now = 1_000_000_000_000;
  let s = applyGrade(emptyState(), GRADES.again, now); // 誤答で復習対象へ
  assert.equal(isInReview(s), true);
  for (let i = 0; i < MASTER_STREAK; i++) s = applyGrade(s, GRADES.easy, now);
  assert.equal(s.correctStreak, MASTER_STREAK);
  assert.equal(isMastered(s), true);
  assert.equal(isInReview(s), false); // マスターしたら復習から外れる
});

test('4回連続の完璧ではまだマスターしない', () => {
  const now = 1_000_000_000_000;
  let s = applyGrade(emptyState(), GRADES.again, now);
  for (let i = 0; i < 4; i++) s = applyGrade(s, GRADES.easy, now);
  assert.equal(isMastered(s), false);
  assert.equal(isInReview(s), true);
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
