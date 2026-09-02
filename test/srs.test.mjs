import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  applyAnswer,
  applyGrade,
  isInReview,
  isMastered,
  isDue,
  isLeech,
  justBecameLeech,
  justResolvedLeech,
  resetDueForReview,
  sortByPriority,
  normalize,
  GRADES,
  MASTER_STREAK,
  LEECH_THRESHOLD,
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

test('○(完璧)を重ねると忘却曲線に沿って間隔が延びる（1→3→7日、以降はefの伸びで16日よりやや長くなる）', () => {
  // efは正解のたびに+0.05され、間隔計算にもその比率（ef/2.5）を掛けるようにした（#14）。
  // 1〜3回目はefの伸びがまだ小さく丸めで吸収されるため原典どおりの1・3・7日のまま、
  // 4回目でわずかに17日（16日ではない）へずれる——これは意図した変化であり、
  // 「efが計算されるだけで使われていない」という以前の状態を修正した結果。
  const now = 1_000_000_000_000;
  let s = applyGrade(emptyState(), GRADES.again, now); // まず誤答で復習対象へ
  s = applyGrade(s, GRADES.easy, now); // 1回目完璧
  assert.equal(s.interval, 1);
  s = applyGrade(s, GRADES.easy, now); // 2回目
  assert.equal(s.interval, 3);
  s = applyGrade(s, GRADES.easy, now); // 3回目
  assert.equal(s.interval, 7);
  s = applyGrade(s, GRADES.easy, now); // 4回目
  assert.equal(s.interval, 17);
});

test('paceMultiplierで正解時の間隔だけを調整できる（誤答の約20分後リセットは変わらない）', () => {
  const now = 1_000_000_000_000;
  let s = applyGrade(emptyState(), GRADES.again, now, { paceMultiplier: 2 });
  assert.equal(s.due, now + 20 * 60 * 1000); // 誤答側はpaceMultiplierの影響を受けない
  s = applyGrade(s, GRADES.easy, now, { paceMultiplier: 2 });
  assert.equal(s.interval, 2); // 1日 × 2倍
});

test('efは上限3.5を超えない（間隔が際限なく伸びないための上限）', () => {
  const now = 1_000_000_000_000;
  let s = applyGrade(emptyState(), GRADES.again, now);
  for (let i = 0; i < 100; i++) {
    s = applyGrade(s, GRADES.easy, now);
    if (isMastered(s)) s = applyGrade(s, GRADES.again, now); // マスターしたら再び誤答で戻す
  }
  assert.ok(s.ef <= 3.5);
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

test('justBecameLeech: LEECH_THRESHOLD回目の誤答でだけtrueになる', () => {
  const now = 1_000_000_000_000;
  let s = emptyState();
  for (let i = 0; i < LEECH_THRESHOLD - 1; i++) s = applyGrade(s, GRADES.again, now);
  assert.equal(isLeech(s), false);
  const prev = s;
  s = applyGrade(s, GRADES.again, now); // ちょうどLEECH_THRESHOLD回目
  assert.equal(isLeech(s), true);
  assert.equal(justBecameLeech(prev, s), true);
});

test('justBecameLeech: 既にリーチだった問題が更に間違えてもfalse（一度きりの通知にするため）', () => {
  const now = 1_000_000_000_000;
  let s = emptyState();
  for (let i = 0; i < LEECH_THRESHOLD; i++) s = applyGrade(s, GRADES.again, now);
  const prev = s;
  s = applyGrade(s, GRADES.again, now);
  assert.equal(justBecameLeech(prev, s), false);
});

test('justResolvedLeech: リーチだった問題がマスターに達した回だけtrue', () => {
  const now = 1_000_000_000_000;
  let s = emptyState();
  for (let i = 0; i < LEECH_THRESHOLD; i++) s = applyGrade(s, GRADES.again, now);
  assert.equal(isLeech(s), true);
  for (let i = 0; i < MASTER_STREAK - 1; i++) s = applyGrade(s, GRADES.easy, now);
  assert.equal(isMastered(s), false);
  const prev = s;
  s = applyGrade(s, GRADES.easy, now); // ちょうどマスター達成
  assert.equal(isMastered(s), true);
  assert.equal(justResolvedLeech(prev, s), true);
});

test('justResolvedLeech: リーチでなかった問題がマスターしてもfalse', () => {
  const now = 1_000_000_000_000;
  let s = applyGrade(emptyState(), GRADES.again, now); // 1回だけ誤答（リーチには遠い）
  for (let i = 0; i < MASTER_STREAK - 1; i++) s = applyGrade(s, GRADES.easy, now);
  const prev = s;
  s = applyGrade(s, GRADES.easy, now);
  assert.equal(isMastered(s), true);
  assert.equal(justResolvedLeech(prev, s), false);
});

test('resetDueForReview: 復習対象だけ期限を今に揃え、マスター済み・未着手には触れない', () => {
  const now = 1_000_000_000_000;
  const later = 5_000_000_000_000;
  const srsMap = {
    inReview: { ...emptyState(), wrongCount: 1, correctStreak: 0, due: later },
    mastered: { ...emptyState(), wrongCount: 1, correctStreak: MASTER_STREAK, due: later },
    untouched: emptyState(),
  };
  const reset = resetDueForReview(srsMap, now);
  assert.equal(reset.inReview.due, now);
  assert.equal(reset.mastered.due, later); // マスター済みは変えない
  assert.equal(reset.untouched.due, 0); // 元々0のまま（触れない）
});
