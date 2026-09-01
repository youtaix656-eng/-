import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISS_TYPES,
  missTypeLabel,
  latestMissType,
  missTypeCounts,
  missTypeTrend,
  missTypeAnomaly,
  totalMissTypeCount,
} from '../src/lib/missTypes.js';

test('missTypeLabel: 既知のidはラベルを返し、未知は空文字', () => {
  assert.equal(missTypeLabel('kanchigai'), '勘違い');
  assert.equal(missTypeLabel('nonexistent'), '');
});

test('latestMissType: 新形式（配列）は末尾を返す', () => {
  const entry = [{ type: 'kanchigai', at: 1 }, { type: 'careless', at: 2 }];
  assert.deepEqual(latestMissType(entry), { type: 'careless', at: 2 });
});

test('latestMissType: 旧形式（単一オブジェクト）もそのまま読める', () => {
  const entry = { type: 'chishiki', at: 5 };
  assert.deepEqual(latestMissType(entry), { type: 'chishiki', at: 5 });
});

test('latestMissType: 未登録（null/undefined）はnull', () => {
  assert.equal(latestMissType(undefined), null);
  assert.equal(latestMissType(null), null);
});

test('missTypeCounts: 基準時刻以降の型別件数を全問題横断で集計する', () => {
  const now = 100000;
  const missTypes = {
    q1: [{ type: 'kanchigai', at: now - 1000 }, { type: 'careless', at: now - 500 }],
    q2: { type: 'kanchigai', at: now - 100 }, // 旧形式も混在
  };
  const counts = missTypeCounts(missTypes, now - 2000);
  assert.equal(counts.kanchigai, 2);
  assert.equal(counts.careless, 1);
  assert.equal(counts.chishiki, 0);
});

test('missTypeCounts: sinceMs より前の記録は数えない', () => {
  const now = 100000;
  const missTypes = { q1: [{ type: 'kanchigai', at: now - 5000 }] };
  const counts = missTypeCounts(missTypes, now - 1000);
  assert.equal(counts.kanchigai, 0);
});

test('missTypeTrend: 直近window日の合計が5件未満ならnull', () => {
  const now = Date.now();
  const missTypes = {
    q1: [{ type: 'careless', at: now - 1000 }, { type: 'careless', at: now - 2000 }],
  };
  assert.equal(missTypeTrend(missTypes, now), null);
});

test('missTypeTrend: 直近で増えた型を返す', () => {
  const now = Date.now();
  const windowMs = 7 * 24 * 60 * 60 * 1000;
  const recentAt = (offsetMs) => now - offsetMs;
  // 直近window内にcarelessを6件（5件以上の母数を満たす）。前の窓には無し。
  const missTypes = {
    q1: Array.from({ length: 6 }, (_, i) => ({ type: 'careless', at: recentAt(1000 * i) })),
  };
  const trend = missTypeTrend(missTypes, now, windowMs);
  assert.ok(trend);
  assert.equal(trend.type, 'careless');
  assert.equal(trend.count, 6);
});

test('missTypeAnomaly: 平常時（母数が少ない/差が小さい）はfalse', () => {
  const now = Date.now();
  const missTypes = { q1: [{ type: 'kanchigai', at: now - 1000 }] };
  const result = missTypeAnomaly(missTypes, now);
  assert.equal(result.isAnomaly, false);
});

test('missTypeAnomaly: 今日3件以上かつ平均の2倍以上なら異常', () => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const entries = [];
  // 今日3件
  for (let i = 0; i < 3; i++) entries.push({ type: 'careless', at: todayStart.getTime() + 1000 * i });
  // 過去13日は1件のみ（平均を低く保つ）
  entries.push({ type: 'careless', at: todayStart.getTime() - 5 * dayMs });
  const missTypes = { q1: entries };
  const result = missTypeAnomaly(missTypes, now, 14);
  assert.equal(result.todayTotal, 3);
  assert.equal(result.isAnomaly, true);
});

test('MISS_TYPES: 3種類（勘違い・知識不足・ケアレス）', () => {
  assert.equal(MISS_TYPES.length, 3);
  const ids = MISS_TYPES.map((t) => t.id);
  assert.deepEqual(new Set(ids), new Set(['kanchigai', 'chishiki', 'careless']));
});

// #23: 誤答理由は自動で間引かない（消すのは手動のみ）。totalMissTypeCountで件数を数える。
test('totalMissTypeCount: 新旧形式を横断して件数を数える', () => {
  const missTypes = {
    q1: [{ type: 'kanchigai', at: 1 }, { type: 'careless', at: 2 }],
    q2: { type: 'chishiki', at: 3 }, // 旧形式（単一オブジェクト）も1件として数える
  };
  assert.equal(totalMissTypeCount(missTypes), 3);
});

test('totalMissTypeCount: 記録が無ければ0', () => {
  assert.equal(totalMissTypeCount({}), 0);
  assert.equal(totalMissTypeCount(undefined), 0);
});
