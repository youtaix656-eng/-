import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayFocusSubjects } from '../src/lib/todayFocus.js';

function mk(name, count, answered, accuracy) {
  return { subject: { id: name, name }, count, answered, correct: 0, accuracy };
}

test('todayFocusSubjects: 収録が無い科目は対象外', () => {
  const scope = [mk('A', 0, 0, null), mk('B', 30, 10, 0.5)];
  const out = todayFocusSubjects(scope, 60);
  assert.deepEqual(out.map((s) => s.subject.name), ['B']);
});

test('todayFocusSubjects: 正答率が低い科目を優先', () => {
  const scope = [mk('得意', 50, 50, 0.95), mk('苦手', 50, 50, 0.2)];
  const out = todayFocusSubjects(scope, 60, { limit: 2 });
  assert.equal(out[0].subject.name, '苦手');
});

test('todayFocusSubjects: 試験まで時間がある時ほど手薄さも考慮する', () => {
  // 正答率は同じくらいだが、片方は収録数が極端に少ない（手薄）
  const scope = [mk('厚い', 100, 20, 0.7), mk('薄い', 2, 2, 0.5)];
  const farOut = todayFocusSubjects(scope, 170, { limit: 2 }); // 試験まで遠い
  const nearOut = todayFocusSubjects(scope, 5, { limit: 2 }); // 試験直前
  // 遠い時は手薄さの影響で「薄い」の優先度が相対的に上がる
  const farGap = farOut.find((s) => s.subject.name === '薄い').score - farOut.find((s) => s.subject.name === '厚い').score;
  const nearGap = nearOut.find((s) => s.subject.name === '薄い').score - nearOut.find((s) => s.subject.name === '厚い').score;
  assert.ok(farGap > nearGap);
});

test('todayFocusSubjects: 未着手は中間の危険度として扱う', () => {
  const scope = [mk('未着手', 50, 0, null)];
  const out = todayFocusSubjects(scope, 60, { limit: 1 });
  assert.equal(out[0].reason, 'まだ手つかず');
});

test('todayFocusSubjects: limitで件数を絞れる', () => {
  const scope = [mk('A', 30, 10, 0.9), mk('B', 30, 10, 0.8), mk('C', 30, 10, 0.7)];
  const out = todayFocusSubjects(scope, 60, { limit: 2 });
  assert.equal(out.length, 2);
});
