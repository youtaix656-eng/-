import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDailySubjectIndex, subjectAt, subjectWrongPool, dailyWrongPickWithFallback } from '../src/lib/audioDailySubject.js';
import { SUBJECT_TAG_NAMES } from '../src/data/examScope.js';

test('resolveDailySubjectIndex：保存状態が無い最初の1回は「生理学」（解剖学の次）から始まる', () => {
  const r = resolveDailySubjectIndex(null, new Date('2026-01-01T00:00:00'));
  assert.equal(subjectAt(r.index), '生理学');
  assert.equal(SUBJECT_TAG_NAMES.indexOf('生理学'), SUBJECT_TAG_NAMES.indexOf('解剖学') + 1);
  assert.equal(r.changed, true);
});

test('resolveDailySubjectIndex：同じ日に何度呼んでも同じ添字のまま変わらない', () => {
  const stored = { index: 5, dateKey: '2026-05-20' };
  const r1 = resolveDailySubjectIndex(stored, new Date('2026-05-20T01:00:00'));
  const r2 = resolveDailySubjectIndex(stored, new Date('2026-05-20T23:59:00'));
  assert.equal(r1.index, 5);
  assert.equal(r2.index, 5);
  assert.equal(r1.changed, false);
  assert.equal(r2.changed, false);
});

test('resolveDailySubjectIndex：日付が変わると1つだけ進む（1▶2▶3▶4）', () => {
  const stored = { index: 3, dateKey: '2026-05-20' }; // 解剖学
  const r = resolveDailySubjectIndex(stored, new Date('2026-05-21T00:00:00'));
  assert.equal(r.index, 4); // 生理学
  assert.equal(r.changed, true);
  assert.equal(r.dateKey, '2026-05-21');
});

test('resolveDailySubjectIndex：14番目（きゅう理論）の次は1番目（医療概論）に一周する', () => {
  const stored = { index: SUBJECT_TAG_NAMES.length - 1, dateKey: '2026-05-20' };
  const r = resolveDailySubjectIndex(stored, new Date('2026-05-21T00:00:00'));
  assert.equal(r.index, 0);
});

test('resolveDailySubjectIndex：数日分まとめて開いても1日1つしか進まない（2日空けたら2つだけ進む）', () => {
  let stored = { index: 0, dateKey: '2026-05-20' };
  stored = resolveDailySubjectIndex(stored, new Date('2026-05-21T00:00:00'));
  stored = resolveDailySubjectIndex(stored, new Date('2026-05-22T00:00:00'));
  assert.equal(stored.index, 2);
});

test('subjectAt：範囲外・負の添字でも循環して科目名を返す', () => {
  assert.equal(subjectAt(0), SUBJECT_TAG_NAMES[0]);
  assert.equal(subjectAt(SUBJECT_TAG_NAMES.length), SUBJECT_TAG_NAMES[0]);
  assert.equal(subjectAt(-1), SUBJECT_TAG_NAMES[SUBJECT_TAG_NAMES.length - 1]);
});

test('subjectWrongPool：指定科目かつisInReview（wrongCount>0かつ未マスター）だけに絞る', () => {
  const subject = '生理学';
  const otherSubject = '解剖学';
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
  const { subject: pickedSubject, pool } = subjectWrongPool(questions, srs, subject);
  assert.equal(pickedSubject, subject);
  assert.deepEqual(pool.map((q) => q.id), ['a']);
});

test('subjectWrongPool：期限が来ている問題を先頭に出す', () => {
  const subject = '生理学';
  const questions = [
    { id: 'notdue', subject },
    { id: 'due', subject },
  ];
  const now = Date.now();
  const srs = {
    notdue: { wrongCount: 1, correctStreak: 0, due: now + 999999999 },
    due: { wrongCount: 1, correctStreak: 0, due: now - 1 },
  };
  const { pool } = subjectWrongPool(questions, srs, subject);
  assert.deepEqual(pool.map((q) => q.id), ['due', 'notdue']);
});

test('subjectWrongPool：対象が0件なら空のpoolを返す（黒いが行き止まりにはしない）', () => {
  const { subject: pickedSubject, pool } = subjectWrongPool([], {}, '生理学');
  assert.equal(pickedSubject, '生理学');
  assert.deepEqual(pool, []);
});

test('dailyWrongPickWithFallback：今日の科目に誤答が無い日は、順番どおり次の誤答がある科目へ回す', () => {
  const i = SUBJECT_TAG_NAMES.indexOf('生理学');
  const later = SUBJECT_TAG_NAMES[(i + 3) % SUBJECT_TAG_NAMES.length];
  const qs = [{ id: 'a', subject: later }];
  const srs = { a: { wrongCount: 1, correctStreak: 0, due: 0 } };
  const r = dailyWrongPickWithFallback(qs, srs, i);
  assert.equal(r.fallback, true);
  assert.equal(r.todaySubject, '生理学');
  assert.equal(r.subject, later);
  assert.equal(r.pool.length, 1);
  const none = dailyWrongPickWithFallback([], {}, i);
  assert.equal(none.fallback, false);
  assert.equal(none.pool.length, 0);
});

import { manualSubjectFor, pillPick, wrongCountBySubject } from '../src/lib/audioDailySubject.js';

test('手で選んだ科目はその日だけ効き、誤答が無くても他の科目へ回さない', () => {
  const now = new Date(2026, 10, 27, 10);
  const key = '2026-11-27';
  assert.equal(manualSubjectFor({ subject: '解剖学', dateKey: key }, now), '解剖学');
  assert.equal(manualSubjectFor({ subject: '解剖学', dateKey: '2026-11-26' }, now), null);
  assert.equal(manualSubjectFor({ subject: 'ない科目', dateKey: key }, now), null);
  const qs = [{ id: 'a', subject: '解剖学' }, { id: 'b', subject: '生理学' }];
  const srs = { b: { wrongCount: 1, correctStreak: 0, due: 0 } };
  const m = pillPick(qs, srs, 3, '解剖学');
  assert.equal(m.subject, '解剖学'); assert.equal(m.pool.length, 0); assert.equal(m.manual, true);
  const auto = pillPick(qs, srs, 3, null); // 解剖学（添字3）に誤答なし → 生理学へ回す
  assert.equal(auto.subject, '生理学'); assert.equal(auto.fallback, true);
  const c = wrongCountBySubject(qs, srs);
  assert.equal(c.get('生理学'), 1); assert.equal(c.get('解剖学'), 0); assert.equal(c.size, 14);
});
