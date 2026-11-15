import test from 'node:test';
import assert from 'node:assert/strict';
import { restorePomoRun, POMO_RUN_KEEP_MS } from '../src/lib/pomoRunState.js';

const T = 1_800_000_000_000;
const MIN = 60 * 1000;

test('保存が無ければ待機中', () => {
  assert.equal(restorePomoRun(null, T, 'simple'), null);
});

test('シンプル：動いたまま閉じて、時間が残っていれば続きから', () => {
  const r = restorePomoRun({ mode: 'simple', running: true, endAt: T + 10 * MIN, savedAt: T - 15 * MIN }, T, 'simple');
  assert.equal(r.running, true);
  assert.equal(r.endAt, T + 10 * MIN);
  assert.equal(r.remaining, 600);
  assert.equal(r.note, 'continued');
});

test('シンプル：閉じている間に時間が過ぎていたら終了になる', () => {
  const r = restorePomoRun({ mode: 'simple', running: true, endAt: T - MIN, savedAt: T - 20 * MIN }, T, 'simple');
  assert.equal(r.running, false);
  assert.equal(r.finished, true);
  assert.equal(r.note, 'ended');
});

test('シンプル：止めたままなら残り秒数を保つ', () => {
  const r = restorePomoRun({ mode: 'simple', running: false, remaining: 432, savedAt: T - MIN }, T, 'simple');
  assert.equal(r.running, false);
  assert.equal(r.remaining, 432);
  assert.equal(r.note, 'paused');
});

test('古すぎる止めかけ・終了は待機中へ戻す', () => {
  const old = T - POMO_RUN_KEEP_MS - 1;
  assert.equal(restorePomoRun({ mode: 'simple', running: false, remaining: 432, savedAt: old }, T, 'simple'), null);
  assert.equal(restorePomoRun({ mode: 'simple', running: true, endAt: old, savedAt: old }, T, 'simple'), null);
});

test('モードが変わっていたら使わない', () => {
  assert.equal(restorePomoRun({ mode: 'simple', running: true, endAt: T + MIN, savedAt: T }, T, 'course2h'), null);
});

test('2時間コース：閉じている間に進んだコマへ追いつく', () => {
  // 勉強1（25分）の残り5分で閉じ、12分後に開く → 休憩1（5分）を越えて勉強2の2分経過
  const r = restorePomoRun({ mode: 'course2h', running: true, coursePhaseIndex: 0, endAt: T - 7 * MIN, savedAt: T - 12 * MIN }, T, 'course2h');
  assert.equal(r.running, true);
  assert.equal(r.coursePhaseIndex, 2);
  assert.equal(r.remaining, 23 * 60);
  assert.equal(r.endAt, T + 23 * MIN);
});

test('2時間コース：全部過ぎていたら終了。終了時刻は本来の2時間後', () => {
  const end0 = T - 200 * MIN; // 勉強1の終わる時刻
  const r = restorePomoRun({ mode: 'course2h', running: true, coursePhaseIndex: 0, endAt: end0, savedAt: end0 - MIN }, T, 'course2h');
  assert.equal(r.finished, true);
  assert.equal(r.running, false);
  assert.equal(r.courseFinishedAt, end0 + 95 * MIN);
});

test('2時間コース：止めたままならコマと残り秒数を保つ', () => {
  const r = restorePomoRun({ mode: 'course2h', running: false, coursePhaseIndex: 3, remaining: 120, savedAt: T - MIN }, T, 'course2h');
  assert.equal(r.coursePhaseIndex, 3);
  assert.equal(r.remaining, 120);
  assert.equal(r.running, false);
});

test('壊れた保存は使わない', () => {
  assert.equal(restorePomoRun({ mode: 'course2h', running: true, coursePhaseIndex: 99, endAt: T + MIN, savedAt: T }, T, 'course2h'), null);
  assert.equal(restorePomoRun({ mode: 'simple', running: true, savedAt: T }, T, 'simple'), null);
  assert.equal(restorePomoRun('x', T, 'simple'), null);
});
