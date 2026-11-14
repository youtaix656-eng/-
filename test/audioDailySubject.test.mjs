import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todaySubject, todaySubjectWrongPool } from '../src/lib/audioDailySubject.js';
import { SUBJECT_TAG_NAMES } from '../src/data/examScope.js';

test('todaySubject：連続した日付で1科目ずつ進む（1▶2▶3▶4）', () => {
  const d0 = new Date('2026-01-01T00:00:00Z');
  const s0 = todaySubject(d0);
  const idx0 = SUBJECT_TAG_NAMES.indexOf(s0);
  for (let i = 1; i <= 4; i++) {
    const d = new Date(d0.getTime() + i * 86400000);
    const s = todaySubject(d);
    const idx = SUBJECT_TAG_NAMES.indexOf(s);
    assert.equal(idx, (idx0 + i) % SUBJECT_TAG_NAMES.length);
  }
});

test('todaySubject：14日経つと一周して元の科目に戻る', () => {
  const d0 = new Date('2026-03-05T00:00:00Z');
  const s0 = todaySubject(d0);
  const d14 = new Date(d0.getTime() + 14 * 86400000);
  assert.equal(todaySubject(d14), s0);
});

test('todaySubject：同じ日なら何回呼んでも同じ科目', () => {
  const d = new Date('2026-05-20T09:00:00Z');
  assert.equal(todaySubject(d), todaySubject(new Date(d)));
});

test('todaySubject：必ずSUBJECT_TAG_NAMESの中の1件を返す', () => {
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() + i * 86400000);
    assert.ok(SUBJECT_TAG_NAMES.includes(todaySubject(d)));
  }
});

test('todaySubjectWrongPool：今日の科目かつisInReview（wrongCount>0かつ未マスター）だけに絞る', () => {
  const date = new Date('2026-01-01T00:00:00Z');
  const subject = todaySubject(date);
  const otherSubject = SUBJECT_TAG_NAMES.find((s) => s !== subject);
  const questions = [
    { id: 'a', subject }, // 誤答あり→対象
    { id: 'b', subject }, // 誤答なし→対象外
    { id: 'c', subject: otherSubject }, // 別科目の誤答→対象外
    { id: 'd', subject }, // マスター済み（correctStreak>=5）→対象外
  ];
  const srs = {
    a: { wrongCount: 2, correctStreak: 0, due: 0 },
    b: { wrongCount: 0, correctStreak: 0, due: 0 },
    c: { wrongCount: 3, correctStreak: 0, due: 0 },
    d: { wrongCount: 1, correctStreak: 5, due: 0 },
  };
  const { subject: pickedSubject, pool } = todaySubjectWrongPool(questions, srs, date);
  assert.equal(pickedSubject, subject);
  assert.deepEqual(pool.map((q) => q.id), ['a']);
});

test('todaySubjectWrongPool：期限が来ている問題を先頭に出す', () => {
  const date = new Date('2026-01-01T00:00:00Z');
  const subject = todaySubject(date);
  const questions = [
    { id: 'notdue', subject },
    { id: 'due', subject },
  ];
  // isDue()の既定nowは実行時の Date.now()（todaySubjectWrongPool は now を上書きしない）
  // なので、due判定は実時刻基準で過去／未来にする。subjectの決定だけは date（テスト固定日）を使う。
  const now = Date.now();
  const srs = {
    notdue: { wrongCount: 1, correctStreak: 0, due: now + 999999999 },
    due: { wrongCount: 1, correctStreak: 0, due: now - 1 },
  };
  const { pool } = todaySubjectWrongPool(questions, srs, date);
  assert.deepEqual(pool.map((q) => q.id), ['due', 'notdue']);
});

test('todaySubjectWrongPool：対象が0件なら空のpoolを返す（黒いが行き止まりにはしない）', () => {
  const date = new Date('2026-01-01T00:00:00Z');
  const subject = todaySubject(date);
  const { subject: pickedSubject, pool } = todaySubjectWrongPool([], {}, date);
  assert.equal(pickedSubject, subject);
  assert.deepEqual(pool, []);
});
