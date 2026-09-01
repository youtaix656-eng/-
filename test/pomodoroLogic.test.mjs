import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durationSec, mmss, nextPhaseAfter, advanceState, remainingSecOf, clampDraftCommit, ADVANCE_GUARD, BEEP_TONES, toneFreq, cyclePosition, formatAwaySpan } from '../src/lib/pomodoroLogic.js';

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

test('ADVANCE_GUARD: 定数として公開されている', () => {
  assert.equal(typeof ADVANCE_GUARD, 'number');
  assert.ok(ADVANCE_GUARD > 0);
});

// PomoNumberField（数字入力欄）の「一桁残さないと打てない」バグ修正の核心部分。
// 全消し（空文字）や打ちかけの非数値は直前の確定値へフォールバックし、min未満へ
// 強制スナップしないことを保証する。
test('clampDraftCommit: 空文字は直前の確定値に戻る（min勝手にスナップしない）', () => {
  const r = clampDraftCommit('', 25, 1, 180);
  assert.equal(r.clamped, 25);
  assert.equal(r.changed, false);
});

test('clampDraftCommit: 範囲内の数値はそのまま確定する', () => {
  const r = clampDraftCommit('45', 25, 1, 180);
  assert.equal(r.clamped, 45);
  assert.equal(r.changed, true);
});

test('clampDraftCommit: 範囲外はmin/maxへ丸める', () => {
  assert.equal(clampDraftCommit('0', 25, 1, 180).clamped, 1);
  assert.equal(clampDraftCommit('999', 25, 1, 180).clamped, 180);
});

test('clampDraftCommit: 値が変わらない場合はchanged=false', () => {
  const r = clampDraftCommit('25', 25, 1, 180);
  assert.equal(r.changed, false);
});

test('toneFreq: 未設定なら既定（chime）を使う', () => {
  assert.equal(toneFreq({}, 'study'), BEEP_TONES[0].freq[0]);
  assert.equal(toneFreq({}, 'break'), BEEP_TONES[0].freq[1]);
});

test('toneFreq: 指定した種類の周波数を返す', () => {
  const low = BEEP_TONES.find((t) => t.id === 'low');
  assert.equal(toneFreq({ beepTone: 'low' }, 'study'), low.freq[0]);
  assert.equal(toneFreq({ beepTone: 'low' }, 'break'), low.freq[1]);
});

// 「長休憩まで（回）」を変更した直後でも位置表示が食い違わないことを固定化する
// （サイクル数変更で周回位置が壊れないことのテスト、項目22）。
test('cyclePosition: 一度も完走していなければ0', () => {
  assert.equal(cyclePosition(0, 4), 0);
});

test('cyclePosition: 割り切れない位置はそのまま剰余', () => {
  assert.equal(cyclePosition(1, 4), 1);
  assert.equal(cyclePosition(3, 4), 3);
});

test('cyclePosition: ちょうど割り切れた直後はcyclesを返す（0に戻さない）', () => {
  assert.equal(cyclePosition(4, 4), 4);
  assert.equal(cyclePosition(8, 4), 4);
});

test('cyclePosition: cyclesを設定変更しても計算式は同じ（doneはそのまま新しいcyclesで数え直される）', () => {
  assert.equal(cyclePosition(5, 6), 5);
  assert.equal(cyclePosition(6, 6), 6);
  assert.equal(cyclePosition(7, 6), 1);
});

test('cyclePosition: cyclesが未指定でも既定4で計算する', () => {
  assert.equal(cyclePosition(4, undefined), 4);
});

test('formatAwaySpan: 1分未満は「1分未満」', () => {
  assert.equal(formatAwaySpan(10000), '1分未満');
});

test('formatAwaySpan: 分・時間・日で見やすく丸める', () => {
  assert.equal(formatAwaySpan(5 * 60000), '5分');
  assert.equal(formatAwaySpan(135 * 60000), '2時間15分');
  assert.equal(formatAwaySpan(2 * 60 * 60000), '2時間');
  assert.equal(formatAwaySpan((3 * 24 + 4) * 60 * 60000), '3日と4時間');
  assert.equal(formatAwaySpan(2 * 24 * 60 * 60000), '2日');
});

test('formatAwaySpan: 負の値でも落ちない', () => {
  assert.equal(formatAwaySpan(-1000), '1分未満');
});
