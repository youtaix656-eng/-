import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPreset, breakAfter, initialTimer, nextPhase, pause, progressOf, recordOf, remainingMs, skip, start, tick } from '../src/lib/session.js';
import { MIN, PRESET } from './fixtures.js';

test('初期状態は集中・待機・残りは集中時間ぶん', () => {
  const t = initialTimer(PRESET);
  assert.equal(t.phase, 'focus');
  assert.equal(t.status, 'idle');
  assert.equal(t.remainingMs, 25 * MIN);
  assert.equal(remainingMs(t, 0), 25 * MIN);
});

test('残り時間は endAt から引き算する（1秒ずつ減らさない）', () => {
  const t = start(initialTimer(PRESET), 1000);
  assert.equal(t.endAt, 1000 + 25 * MIN);
  assert.equal(remainingMs(t, 1000 + 10 * MIN), 15 * MIN);
  // 裏で長く止まっても、戻った時の残りは本物の時刻から出る
  assert.equal(remainingMs(t, 1000 + 40 * MIN), 0);
  assert.equal(progressOf(t, 1000 + 12.5 * MIN), 0.5);
});

test('一時停止→再開で残りが保たれる', () => {
  let t = start(initialTimer(PRESET), 0);
  t = pause(t, 5 * MIN);
  assert.equal(t.status, 'paused');
  assert.equal(t.remainingMs, 20 * MIN);
  t = start(t, 100 * MIN);
  assert.equal(t.endAt, 120 * MIN);
});

test('集中→短い休憩→集中…→最後は長い休憩→最初へ戻る', () => {
  let t = initialTimer(PRESET);
  const seq: string[] = [];
  for (let i = 0; i < 8; i++) {
    t = nextPhase(t, PRESET);
    seq.push(`${t.phase}${t.phase === 'focus' ? t.pomoIndex : ''}`);
  }
  assert.deepEqual(seq, ['short', 'focus1', 'short', 'focus2', 'short', 'focus3', 'long', 'focus0']);
  assert.equal(breakAfter(3, PRESET), 'long');
  assert.equal(breakAfter(2, PRESET), 'short');
});

test('tick：終わっていれば局面を閉じ、自動なら「終わった時刻から」次を始める', () => {
  const t = start(initialTimer(PRESET), 0);
  const r = tick(t, PRESET, true, 25 * MIN + 3000);
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].kind, 'completed');
  assert.equal(r.events[0].phase, 'focus');
  assert.equal(r.events[0].at, 25 * MIN);
  assert.equal(r.autoStarted, 1);
  assert.equal(r.state.phase, 'short');
  assert.equal(r.state.status, 'running');
  // 次の局面は 25分ちょうどから始まっているので、終わりは 30分
  assert.equal(r.state.endAt, 30 * MIN);
});

test('tick：自動で進めない設定なら次を用意して待機', () => {
  const t = start(initialTimer(PRESET), 0);
  const r = tick(t, PRESET, false, 26 * MIN);
  assert.equal(r.state.phase, 'short');
  assert.equal(r.state.status, 'idle');
  assert.equal(r.autoStarted, 0);
});

test('tick：裏で長く止まっていたら複数の局面をまとめて追いつく', () => {
  const t = start(initialTimer(PRESET), 0);
  // 25 + 5 + 25 = 55分 → 3局面ぶん終わっている
  const r = tick(t, PRESET, true, 56 * MIN);
  assert.equal(r.events.length, 3);
  assert.deepEqual(r.events.map((e) => e.phase), ['focus', 'short', 'focus']);
  assert.equal(r.state.phase, 'short');
  assert.equal(r.state.pomoIndex, 1);
  assert.equal(r.state.endAt, 60 * MIN);
});

test('tick：まだ終わっていなければ何も起きない', () => {
  const t = start(initialTimer(PRESET), 0);
  const r = tick(t, PRESET, true, 10 * MIN);
  assert.equal(r.events.length, 0);
  assert.equal(r.state, t);
});

test('skip：集中していた分だけ記録に残し、1分未満は残さない', () => {
  const t = start(initialTimer(PRESET), 0);
  const r = skip(t, PRESET, 7 * MIN);
  assert.equal(r.event.kind, 'skipped');
  assert.equal(r.event.focusedMs, 7 * MIN);
  assert.equal(r.state.phase, 'short');
  assert.equal(r.state.status, 'idle');
  const rec = recordOf(r.event, 'x', () => '2026-09-12');
  assert.ok(rec);
  assert.equal(rec!.durationMinutes, 7);
  assert.equal(rec!.completed, false);
  const tiny = skip(start(initialTimer(PRESET), 0), PRESET, 20000);
  assert.equal(recordOf(tiny.event, 'y', () => '2026-09-12'), null);
});

test('休憩は記録にしない', () => {
  const t = start(nextPhase(start(initialTimer(PRESET), 0), PRESET), 0);
  const r = tick(t, PRESET, false, 6 * MIN);
  assert.equal(r.events[0].phase, 'short');
  assert.equal(recordOf(r.events[0], 'z', () => '2026-09-12'), null);
});

test('applyPreset：走っている間は変えない・一時停止中は進んだぶんを保つ', () => {
  const running = start(initialTimer(PRESET), 0);
  assert.equal(applyPreset(running, { ...PRESET, focusMinutes: 50 }), running);
  const paused = pause(running, 10 * MIN);
  const changed = applyPreset(paused, { ...PRESET, focusMinutes: 50 });
  assert.equal(changed.durationMs, 50 * MIN);
  assert.equal(changed.remainingMs, 40 * MIN);
  const idle = applyPreset(initialTimer(PRESET), { ...PRESET, focusMinutes: 10 });
  assert.equal(idle.remainingMs, 10 * MIN);
});
