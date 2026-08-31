import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previousForTarget, formatDuration, speedupPct, countForTarget } from '../src/lib/roundLog.js';

test('previousForTarget: 同じtargetで最新のものを返す', () => {
  const log = [
    { target: 60, ms: 1000, at: 1 },
    { target: 10, ms: 2000, at: 2 },
    { target: 60, ms: 3000, at: 3 },
  ];
  const p = previousForTarget(log, 60);
  assert.equal(p.at, 3);
});

test('previousForTarget: excludeAtで自分自身を除外できる', () => {
  const log = [{ target: 60, ms: 1000, at: 1 }, { target: 60, ms: 3000, at: 3 }];
  const p = previousForTarget(log, 60, 3);
  assert.equal(p.at, 1);
});

test('previousForTarget: 対象がなければnull', () => {
  assert.equal(previousForTarget([], 60), null);
  assert.equal(previousForTarget([{ target: 10, ms: 1, at: 1 }], 60), null);
});

test('formatDuration: 分秒に整形する', () => {
  assert.equal(formatDuration(5000), '5秒');
  assert.equal(formatDuration(65000), '1分5秒');
  assert.equal(formatDuration(0), '0秒');
});

test('speedupPct: 1問あたりの時間で短縮率を計算する（問数が違っても比較できる）', () => {
  // 前回：60問で60000ms(1問1000ms) → 今回：60問で30000ms(1問500ms)＝50%短縮
  assert.equal(speedupPct(30000, 60, 60000, 60), 50);
  // 問数が違っても1問あたりで比較する：前回10問で10000ms(1問1000ms)、今回60問で48000ms(1問800ms)＝20%短縮
  assert.equal(speedupPct(48000, 60, 10000, 10), 20);
});

test('speedupPct: 遅くなった場合は負の値', () => {
  assert.equal(speedupPct(90000, 60, 60000, 60), -50);
});

test('speedupPct: 比較材料が無ければnull（0除算しない）', () => {
  assert.equal(speedupPct(1000, 10, 0, 0), null);
  assert.equal(speedupPct(1000, 0, 1000, 10), null);
});

test('countForTarget: 同じtargetの完了回数を数える（通算◯回目の表示用）', () => {
  const log = [
    { target: 900, ms: 1, at: 1 },
    { target: 10, ms: 1, at: 2 },
    { target: 900, ms: 1, at: 3 },
    { target: 900, ms: 1, at: 4 },
  ];
  assert.equal(countForTarget(log, 900), 3);
  assert.equal(countForTarget(log, 10), 1);
  assert.equal(countForTarget(log, 60), 0);
  assert.equal(countForTarget([], 900), 0);
});
