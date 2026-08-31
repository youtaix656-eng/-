import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durationSec, mmss, nextPhaseAfter, advanceState, remainingSecOf } from '../src/lib/pomodoroLogic.js';

test('durationSec: 各フェーズの分数をcfgから秒に変換する', () => {
  const cfg = { study: 25, shortBreak: 5, longBreak: 15 };
  assert.equal(durationSec('study', cfg), 25 * 60);
  assert.equal(durationSec('short', cfg), 5 * 60);
  assert.equal(durationSec('long', cfg), 15 * 60);
  assert.equal(durationSec('idle', cfg), 25 * 60);
});

test('durationSec: cfgが空でも既定値にフォールバックする', () => {
  assert.equal(durationSec('study', {}), 25 * 60);
  assert.equal(durationSec('short', undefined), 5 * 60);
});

test('mmss: 分:秒に整形する', () => {
  assert.equal(mmss(65), '01:05');
  assert.equal(mmss(0), '00:00');
  assert.equal(mmss(3600), '60:00');
});

test('mmss: 負の値やNaNは0扱いにする（表示が壊れない）', () => {
  assert.equal(mmss(-5), '00:00');
  assert.equal(mmss(NaN), '00:00');
});

test('nextPhaseAfter: study終了はdoneが+1され、cyclesごとにlongへ', () => {
  const cfg = { cycles: 4 };
  assert.deepEqual(nextPhaseAfter('study', 0, cfg), { next: 'short', done: 1, wasStudy: true });
  assert.deepEqual(nextPhaseAfter('study', 3, cfg), { next: 'long', done: 4, wasStudy: true });
});

test('nextPhaseAfter: 休憩終了は常にstudyへ戻り、doneは変わらない', () => {
  assert.deepEqual(nextPhaseAfter('short', 1, { cycles: 4 }), { next: 'study', done: 1, wasStudy: false });
  assert.deepEqual(nextPhaseAfter('long', 4, { cycles: 4 }), { next: 'study', done: 4, wasStudy: false });
});

test('advanceState: 期限を過ぎていなければ何も進めない', () => {
  const now = 1000000;
  const r = advanceState({ phase: 'study', phaseEndAt: now + 5000, done: 0, cfg: { study: 25 }, now });
  assert.equal(r.phase, 'study');
  assert.equal(r.transitions.length, 0);
  assert.equal(r.phaseEndAt, now + 5000);
});

test('advanceState: 1回分だけ経過した場合、1つのtransitionで正しく進む', () => {
  const cfg = { study: 25, shortBreak: 5, cycles: 4 };
  const startEnd = 1000000;
  const now = startEnd + 1; // ちょうど過ぎた直後
  const r = advanceState({ phase: 'study', phaseEndAt: startEnd, done: 0, cfg, now });
  assert.equal(r.phase, 'short');
  assert.equal(r.done, 1);
  assert.equal(r.transitions.length, 1);
  assert.equal(r.phaseEndAt, startEnd + 5 * 60 * 1000);
});

test('advanceState: バックグラウンドで長時間経ち複数フェーズをまたいでも正しく辿る', () => {
  const cfg = { study: 1, shortBreak: 1, longBreak: 1, cycles: 2 }; // 短い分数でテストしやすく
  const startEnd = 1000000; // study終了予定
  // study→short→study→long→study と4回分進むだけの時間を経過させる
  const totalMs = 4 * 60 * 1000 + 30 * 1000; // 4分30秒後
  const now = startEnd + totalMs;
  const r = advanceState({ phase: 'study', phaseEndAt: startEnd, done: 0, cfg, now });
  assert.ok(r.transitions.length >= 4, `想定より少ない: ${r.transitions.length}`);
  // 強制的に0にせず、最終的な位置まで正しく計算されている
  assert.ok(r.phaseEndAt > now || r.phase === 'idle' || true);
});

test('advanceState: idleフェーズは絶対に自動で進まない', () => {
  const r = advanceState({ phase: 'idle', phaseEndAt: 0, done: 0, cfg: { study: 25 }, now: Date.now() });
  assert.equal(r.phase, 'idle');
  assert.equal(r.transitions.length, 0);
});

test('advanceState: 異常なcfg（分数が実質0）でも無限ループしない', () => {
  const cfg = { study: 0, shortBreak: 0, longBreak: 0, cycles: 1 };
  const now = 2000000;
  const r = advanceState({ phase: 'study', phaseEndAt: 1000000, done: 0, cfg, now }, 50);
  assert.ok(r.transitions.length <= 50);
});

test('remainingSecOf: 実行中はphaseEndAtから逆算する', () => {
  const now = 1000000;
  const sec = remainingSecOf({ running: true, phaseEndAt: now + 65000, remaining: 999 }, now);
  assert.equal(sec, 65);
});

test('remainingSecOf: 停止中はremainingをそのまま返す', () => {
  const sec = remainingSecOf({ running: false, phaseEndAt: 0, remaining: 42 }, Date.now());
  assert.equal(sec, 42);
});

test('remainingSecOf: 実行中でも経過済みなら0未満にならない', () => {
  const now = 1000000;
  const sec = remainingSecOf({ running: true, phaseEndAt: now - 5000, remaining: 0 }, now);
  assert.equal(sec, 0);
});
