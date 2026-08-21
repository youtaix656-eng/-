import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLabel, makeRecord, sortRecords, upsertRecord, removeRecord, filterRecords,
  clientLabels, historyOf, previousOf, compareWithPrevious, painTrend, summarizeRecords,
  MAX_RECORDS, CLIENT_LABEL_MAX,
} from '../src/lib/records.js';

const DAY = 86400000;
const base = 1_700_000_000_000;
const src = (at) => ({ at, symptomId: 'lowback', answers: { pain: 5 }, tags: ['aggr:flexion'] });
const rec = (at, extra = {}) => makeRecord(src(at), { seed: at, ...extra });

test('normalizeLabel: 前後の空白を落とし、長すぎる入力は切り詰める', () => {
  assert.equal(normalizeLabel('  A様  '), 'A様');
  assert.equal(normalizeLabel('田中　　T'), '田中 T');
  assert.equal(normalizeLabel('あ'.repeat(50)).length, CLIENT_LABEL_MAX);
  assert.equal(normalizeLabel(undefined), '');
});

test('makeRecord: 入力（タグ）を保持し、メモは空で始まる', () => {
  const r = rec(base, { clientLabel: ' A様 ', pain: 7, triageLevel: 'caution' });
  assert.equal(r.clientLabel, 'A様');
  assert.equal(r.pain, 7);
  assert.equal(r.triageLevel, 'caution');
  assert.deepEqual(r.tags, ['aggr:flexion']);
  assert.equal(r.memo, '');
  assert.equal(r.at, r.updatedAt);
});

test('upsertRecord: 同じIDは置き換え、新しい順に並ぶ', () => {
  const a = rec(base);
  const b = rec(base + DAY);
  let list = upsertRecord([], a);
  list = upsertRecord(list, b);
  assert.deepEqual(list.map((r) => r.at), [base + DAY, base]);
  list = upsertRecord(list, { ...a, memo: '更新' });
  assert.equal(list.length, 2);
  assert.equal(list.find((r) => r.at === base).memo, '更新');
});

test('upsertRecord: 上限を超えたら古いものから捨てる', () => {
  let list = [];
  for (let i = 0; i < MAX_RECORDS + 5; i += 1) list = upsertRecord(list, rec(base + i * 1000));
  assert.equal(list.length, MAX_RECORDS);
  assert.equal(list[list.length - 1].at, base + 5000); // 古い5件が落ちている
});

test('removeRecord: 指定のIDだけ消える', () => {
  const a = rec(base);
  const b = rec(base + DAY);
  const list = removeRecord([a, b], a.id);
  assert.deepEqual(list.map((r) => r.id), [b.id]);
});

test('filterRecords: 表示名・メモ・トリアージで絞り込める', () => {
  const list = [
    { ...rec(base), clientLabel: 'A様', memo: '起立筋の緊張', triageLevel: 'clear' },
    { ...rec(base + DAY), clientLabel: 'B様', memo: '', triageLevel: 'refer' },
  ];
  assert.equal(filterRecords(list, { query: '起立筋' }).length, 1);
  assert.equal(filterRecords(list, { level: 'refer' })[0].clientLabel, 'B様');
  assert.equal(filterRecords(list, { label: 'A様' }).length, 1);
  assert.equal(filterRecords(list, {}).length, 2);
  assert.equal(filterRecords(list, { query: '存在しない' }).length, 0);
});

test('clientLabels: 件数の多い順。表示名なしは数えない', () => {
  const list = [
    { ...rec(base), clientLabel: 'A様' },
    { ...rec(base + 1), clientLabel: 'A様' },
    { ...rec(base + 2), clientLabel: 'B様' },
    { ...rec(base + 3), clientLabel: '' },
  ];
  assert.deepEqual(clientLabels(list), [{ label: 'A様', count: 2 }, { label: 'B様', count: 1 }]);
});

test('historyOf / previousOf: 同じ表示名の前回だけを拾う', () => {
  const a1 = { ...rec(base), clientLabel: 'A様' };
  const a2 = { ...rec(base + DAY), clientLabel: 'A様' };
  const b1 = { ...rec(base + DAY * 2), clientLabel: 'B様' };
  const list = [a1, a2, b1];
  assert.deepEqual(historyOf(list, 'A様').map((r) => r.at), [base + DAY, base]);
  assert.equal(previousOf(list, a2).at, base);
  assert.equal(previousOf(list, a1), null, '最初の記録に前回はない');
  assert.equal(previousOf(list, b1), null, '別の人の記録は前回にしない');
  assert.equal(previousOf(list, { ...rec(base), clientLabel: '' }), null, '表示名なしは比較しない');
});

test('compareWithPrevious: ペインスケールの変化を文章にする', () => {
  const prev = { ...rec(base), clientLabel: 'A様', pain: 7, triageLevel: 'clear' };
  const now = { ...rec(base + DAY * 7), clientLabel: 'A様', pain: 4, triageLevel: 'clear' };
  const d = compareWithPrevious(now, prev);
  assert.equal(d.days, 7);
  assert.equal(d.painDelta, -3);
  assert.match(d.painText, /低下/);
  assert.equal(d.triageChanged, false);
});

test('compareWithPrevious: 数字が無ければ痛みの変化は評価しない（憶測しない）', () => {
  const prev = { ...rec(base), clientLabel: 'A様', pain: null };
  const now = { ...rec(base + DAY), clientLabel: 'A様', pain: 5 };
  const d = compareWithPrevious(now, prev);
  assert.equal(d.painDelta, null);
  assert.equal(d.painText, '');
});

test('compareWithPrevious: トリアージが変わったら知らせる', () => {
  const prev = { ...rec(base), clientLabel: 'A様', triageLevel: 'clear', pain: 3 };
  const now = { ...rec(base + DAY), clientLabel: 'A様', triageLevel: 'refer', pain: 3 };
  assert.equal(compareWithPrevious(now, prev).triageChanged, true);
});

test('compareWithPrevious: 前回が無ければ null', () => {
  assert.equal(compareWithPrevious(rec(base), null), null);
});

test('painTrend: 古い順、数値のある記録だけ', () => {
  const list = [
    { ...rec(base), clientLabel: 'A様', pain: 8 },
    { ...rec(base + DAY), clientLabel: 'A様', pain: null },
    { ...rec(base + DAY * 2), clientLabel: 'A様', pain: 5 },
  ];
  assert.deepEqual(painTrend(list, 'A様').map((p) => p.pain), [8, 5]);
});

test('summarizeRecords: 件数・人数・受診をすすめた回数', () => {
  const list = [
    { ...rec(base), clientLabel: 'A様', triageLevel: 'clear' },
    { ...rec(base + DAY), clientLabel: 'A様', triageLevel: 'refer' },
    { ...rec(base + DAY * 2), clientLabel: 'B様', triageLevel: 'stop' },
  ];
  const s = summarizeRecords(list);
  assert.equal(s.total, 3);
  assert.equal(s.clients, 2);
  assert.equal(s.needsCare, 2);
  assert.equal(s.lastAt, base + DAY * 2);
});

test('sortRecords: 元の配列を書き換えない', () => {
  const list = [rec(base), rec(base + DAY)];
  const copy = [...list];
  sortRecords(list);
  assert.deepEqual(list, copy);
});
