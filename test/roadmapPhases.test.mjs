import test from 'node:test';
import assert from 'node:assert/strict';
import { upcomingPhaseChange, parseMixRatio, phaseForDate, ROADMAP_PHASES } from '../src/data/roadmapPhases.js';

test('upcomingPhaseChange: フェーズ終了が近ければ次フェーズを返す（#20）', () => {
  const p1 = ROADMAP_PHASES.find((p) => p.id === 'p1');
  // p1の最終日ちょうど（daysUntil=1）
  const res = upcomingPhaseChange(p1.end, 7);
  assert.ok(res);
  assert.equal(res.current.id, 'p1');
  assert.equal(res.next.id, 'p2');
  assert.equal(res.daysUntil, 1);
});

test('upcomingPhaseChange: まだ先ならnull', () => {
  const p1 = ROADMAP_PHASES.find((p) => p.id === 'p1');
  assert.equal(upcomingPhaseChange(p1.start, 7), null);
});

test('upcomingPhaseChange: 該当フェーズが無い日付はnull', () => {
  assert.equal(upcomingPhaseChange('2000-01-01', 7), null);
});

test('parseMixRatio: 「新規X：復習Y」を百分率に変換する', () => {
  assert.deepEqual(parseMixRatio('新規7：復習3'), { newPct: 70, reviewPct: 30 });
  assert.deepEqual(parseMixRatio('新規3：復習7'), { newPct: 30, reviewPct: 70 });
});

test('parseMixRatio: 自由文（機械可読でない）はnull（手元に無い基準を作らない）', () => {
  assert.equal(parseMixRatio('復習中心（新規は残りの穴だけ）'), null);
  assert.equal(parseMixRatio('△✕（間違えた問題）だけ'), null);
  assert.equal(parseMixRatio(undefined), null);
});

test('phaseForDate: 既存の動作に影響なし（回帰確認）', () => {
  const p1 = ROADMAP_PHASES.find((p) => p.id === 'p1');
  assert.equal(phaseForDate(p1.start)?.id, 'p1');
});
