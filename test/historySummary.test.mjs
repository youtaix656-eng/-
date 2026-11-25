import test from 'node:test';
import assert from 'node:assert/strict';
import { overallStats, subjectStats, accuracyTrend } from '../src/lib/stats.js';
import { mergeHistory } from '../src/lib/progressMerge.js';
import { summarizeHistoryForTransfer } from '../src/lib/sync.js';
import { exportHistoryCsv } from '../src/lib/historyExport.js';

const DAY = 86400000;
const now = Date.UTC(2026, 10, 25);
const old = (i, correct) => ({ questionId: `q${i}`, at: now - 200 * DAY + i * 1000, correct, subject: '解剖学' });
const full = [...Array.from({ length: 10 }, (_, i) => old(i, i < 7)), { questionId: 'r', at: now - DAY, correct: true, subject: '解剖学' }];

test('軽量化でまとめた記録は n 件ぶんとして数える', () => {
  const s = summarizeHistoryForTransfer(full, now);
  assert.ok(s.length < full.length);
  assert.deepEqual(overallStats(s), overallStats(full));
  const a = subjectStats(s, []).find((x) => x.subject === '解剖学');
  assert.equal(a.total, 11);
  assert.equal(accuracyTrend(s, 1)[0]?.n ?? 11, 11);
});

test('まとめをもう一度まとめても件数が減らない', () => {
  const s1 = summarizeHistoryForTransfer(full, now);
  const s2 = summarizeHistoryForTransfer(s1, now);
  assert.equal(overallStats(s2).total, 11);
});

test('片方がまとめてあると、まとめた日までの1件ずつの記録は落とす（二重に数えない）', () => {
  const s = summarizeHistoryForTransfer(full, now);
  const m = mergeHistory(s, full);
  assert.equal(overallStats(m).total, 11);
  assert.ok(m.every((e) => e.n != null || e.at > now - 100 * DAY));
});

test('CSV にまとめの件数が出る', () => {
  const s = summarizeHistoryForTransfer(full, now);
  const csv = exportHistoryCsv(s, []);
  assert.match(csv.split('\n')[0], /件数/);
  assert.ok(csv.includes('（古い履歴のまとめ）'));
});
