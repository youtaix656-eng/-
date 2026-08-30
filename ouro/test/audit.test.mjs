// 操作履歴の「畳む」処理（新項目08）のテスト。
//
// 監査の記録なので **消してはいけない**。件数と費用が残ることを機械チェックする。

import test from 'node:test';
import assert from 'node:assert/strict';
import { foldAudit, appendAudit, makeEntry, FOLD_ACTION, AUDIT_LIMIT, totalCost } from '../src/lib/audit.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function entry(daysAgo, action = 'stepRun', cost = 0) {
  return { id: `e${daysAgo}_${action}_${cost}`, at: NOW - daysAgo * DAY, actor: 'user', action, cost };
}

test('30日より新しい記録は畳まない', () => {
  const list = [entry(1), entry(10), entry(29)];
  const { list: out, folded } = foldAudit(list, { now: NOW });
  assert.equal(folded, 0);
  assert.equal(out, list, '変化が無い時は同じ配列をそのまま返す');
});

test('古い記録は日ごとに1件へまとまる', () => {
  const list = [entry(40, 'stepRun'), entry(40, 'knowledgeCreated'), entry(31), entry(2)];
  const { list: out, folded } = foldAudit(list, { now: NOW });
  assert.equal(folded, 3, '古い3件が畳まれる');
  // 40日前の2件 → 1件、31日前の1件…だが単独は畳む対象に含まれる（合計2件）＋新しい1件
  assert.equal(out.length, 3);
  assert.equal(out.filter((e) => e.action === FOLD_ACTION).length, 2);
});

test('畳んでも件数と費用は失われない', () => {
  const list = [entry(40, 'stepRun', 0.5), entry(40, 'stepRun', 0.25), entry(1, 'stepRun', 1)];
  const { list: out } = foldAudit(list, { now: NOW });
  const folded = out.find((e) => e.action === FOLD_ACTION);
  assert.equal(folded.count, 2, '何件をまとめたかが残る');
  assert.ok(Math.abs(totalCost(out) - 1.75) < 1e-9, '費用の合計が変わってしまっている');
  assert.match(folded.detail, /2件/);
});

test('同じ記録を二度畳まない', () => {
  const once = foldAudit([entry(40), entry(41)], { now: NOW });
  const twice = foldAudit(once.list, { now: NOW });
  assert.equal(twice.folded, 0);
  assert.equal(twice.list, once.list);
});

test('畳んだ結果も時刻の昇順になっている（保存の並びが崩れない）', () => {
  const list = [entry(2), entry(40), entry(60), entry(1)];
  const { list: out } = foldAudit(list, { now: NOW });
  for (let i = 1; i < out.length; i += 1) {
    assert.ok(out[i - 1].at <= out[i].at, '時刻の順番が崩れている');
  }
});

test('時刻の無い記録は畳まない（壊れたデータで消さない）', () => {
  const broken = { id: 'x', action: 'stepRun' };
  const { list: out, folded } = foldAudit([broken, entry(40), entry(41)], { now: NOW });
  assert.equal(folded, 2);
  assert.ok(out.some((e) => e.id === 'x'), '時刻の無い記録が消えている');
});

test('上限に達したら、古い記録を落とさずに畳んで枠を作る', () => {
  // 以前は slice で捨てていた。foldAudit は「30日より古いもの」しか畳まないので、
  // 30日以内に上限へ達すると、畳まれる前に消えていた
  // （「消すのではなく畳む」という約束と矛盾していた）。
  let list = [];
  const N = AUDIT_LIMIT + 50;
  for (let i = 0; i < N; i += 1) list = appendAudit(list, makeEntry({ action: 'stepRun', cost: 0.01 }));
  assert.ok(list.length <= AUDIT_LIMIT);
  const folded = list.filter((e) => e.action === FOLD_ACTION);
  assert.ok(folded.length > 0, '畳まれた記録が無い＝そのまま消えている');
  const counted = folded.reduce((n, e) => n + (e.count || 0), 0) + (list.length - folded.length);
  assert.equal(counted, N, '件数が失われている');
  assert.ok(Math.abs(totalCost(list) - N * 0.01) < 1e-6, '費用の合計が失われている');
});
