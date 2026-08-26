// 「改善点10件・2周目」で入れた変更のテスト。

import test from 'node:test';
import assert from 'node:assert/strict';

import { createDeal, dealAiCost, revenueSummary } from '../src/lib/revenue.js';
import { isToolEnabled, TOOLS } from '../src/data/tools.js';
import { failureAdvice, httpError } from '../src/lib/providers/stream.js';
import { addCost, spentThisMonthOf } from '../src/lib/permissions.js';
import { appendAudit, makeEntry, AUDIT_LIMIT, FOLD_ACTION } from '../src/lib/audit.js';
import { makeSettings } from '../src/lib/defaults.js';
import { INGEST_KINDS, ingestOne } from '../src/lib/ingest.js';
import * as plans from '../src/data/plans.js';
import * as ingest from '../src/lib/ingest.js';

// ───────── ① 案件のAI費用は task.dealId で数える ─────────

test('案件にかかったAI費用が0にならない', () => {
  const deal = createDeal({ title: '記事', fee: 12000, status: 'paid', hoursSpent: 2 });
  const tasks = [
    { id: 't1', dealId: deal.id, totalCost: 0.5 },
    { id: 't2', dealId: 'よその案件', totalCost: 9 },
    { id: 't3', dealId: deal.id, totalCost: 0.3 },
  ];
  assert.equal(Math.round(dealAiCost(deal, tasks, 155)), 124, '費用が拾えていない');
  const s = revenueSummary([deal], tasks, { usdJpy: 155 });
  assert.ok(s.aiCost > 0, '合計にも入っていない');
  assert.ok(s.profit < 12000, '手残りが報酬と同額のままになっている');
});

test('案件は taskIds を持たない（結びつきは仕事の側の dealId だけ）', () => {
  assert.equal(createDeal({ title: 'x' }).taskIds, undefined, '二重管理が復活している');
});

test('紐づく仕事が無ければ費用は0', () => {
  const deal = createDeal({ title: 'x', fee: 1000 });
  assert.equal(dealAiCost(deal, [{ id: 't', dealId: 'other', totalCost: 5 }], 155), 0);
  assert.equal(dealAiCost(null, [], 155), 0);
});

// ───────── ④ 会社として切った道具は誰も使えない ─────────

test('接続の記録が無ければ使ってよい（初回から止めない）', () => {
  assert.equal(isToolEnabled([], 'web'), true);
  assert.equal(isToolEnabled(undefined, 'web'), true);
});

test('明示的に解除した道具だけ止まる', () => {
  assert.equal(isToolEnabled([{ toolId: 'web', enabled: false }], 'web'), false);
  assert.equal(isToolEnabled([{ toolId: 'web', enabled: true }], 'web'), true);
  assert.equal(isToolEnabled([{ toolId: 'web', enabled: false }], 'webfetch'), true, '別の道具まで止めている');
});

// ───────── ⑤ PDF は読めるふりをしない ─────────

test('PDFを読み取る仕掛けは残していない', () => {
  assert.equal(ingest.fileToBase64, undefined, '使われていない読み取り処理が残っている');
  assert.equal(ingest.canReadFile, undefined);
  assert.equal(ingest.MAX_PDF_BYTES, undefined);
});

test('PDFの説明が「貼り付け」だと伝えている', () => {
  const pdf = INGEST_KINDS.find((k) => k.id === 'pdf');
  assert.match(pdf.hint, /貼|未対応/, '読み取れるように読める説明のままになっている');
});

test('取り込んだ情報の来歴は external か user（ai にしない）', () => {
  assert.equal(ingestOne({ kind: 'web', url: 'https://example.com', text: 'x' }).knowledge.origin, 'external');
  assert.equal(ingestOne({ kind: 'note', text: '自分のメモ' }).knowledge.origin, 'user');
});

// ───────── ⑥ 在籍数の上限は持たない ─────────

test('在籍数の上限は無くなっている（接続数の上限は残る）', () => {
  assert.equal(plans.employeeLimit, undefined, '在籍数の上限が残っている');
  assert.equal(typeof plans.connectionLimit, 'function', '接続数の上限まで消している');
  for (const p of plans.PLANS) {
    assert.equal(p.maxEmployees, undefined, `${p.id} に在籍上限が残っている`);
    assert.ok(Number.isFinite(p.maxConnections), `${p.id} に接続上限が無い`);
  }
});

// ───────── ⑧ 失敗の理由に「次にすること」を書く ─────────

test('状態番号ごとに、次にすることが書かれる', () => {
  assert.match(failureAdvice(401), /キー/);
  assert.match(failureAdvice(403), /キー/);
  assert.match(failureAdvice(429), /時間/);
  assert.match(failureAdvice(402), /残高|利用枠/);
  assert.match(failureAdvice(503), /エンジン/);
  assert.match(failureAdvice(0), /電波|通信/);
});

test('画面に出る文には英語のJSONを混ぜない（生の本文は detail に残す）', () => {
  const raw = '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}';
  const e = httpError('Claude', { status: 401, headers: { get: () => null } }, raw);
  assert.doesNotMatch(e.message, /authentication_error/, '生のJSONがそのまま画面に出る');
  assert.match(e.message, /キー/);
  assert.equal(e.status, 401);
  assert.match(e.detail, /authentication_error/, '調べるための本文まで消している');
});

// ───────── ⑦ 目次の守備範囲 ─────────

test('目次は「会社の組み立て」だけを載せる（作った知識は載せない）', async () => {
  const { buildToc } = await import('../src/data/toc.js');
  const kinds = new Set(buildToc({ employees: [], customGenres: [] }).map((e) => e.kind));
  assert.ok(!kinds.has('knowledge'), '読みの無い知識を目次に載せている（その他行に落ちる）');
  assert.ok(!kinds.has('deal'));
  assert.ok(kinds.has('role') && kinds.has('tool'));
});

// ───────── 検査で見つかった不具合の再発防止 ─────────

test('費用は操作履歴を数え直さず、設定に積み上げる', () => {
  // 履歴は起動時に新しい400件しか読まない。数え直すと実際より小さく出て、
  // 月の上限が効かなくなる。
  let st = makeSettings();
  st = addCost(st, 0.5);
  st = addCost(st, 0.25);
  assert.equal(st.costTotalUsd, 0.75);
  assert.equal(spentThisMonthOf(st), 0.75);
});

test('月が変わったら今月ぶんは0に戻り、合計は続く', () => {
  const now = new Date(2026, 7, 20).getTime();
  const next = new Date(2026, 8, 3).getTime();
  let st = addCost(makeSettings(), 4, now);
  assert.equal(spentThisMonthOf(st, now), 4);
  assert.equal(spentThisMonthOf(st, next), 0, '月をまたいでも上限に当たり続ける');
  st = addCost(st, 1, next);
  assert.equal(st.costMonthUsd, 1);
  assert.equal(st.costTotalUsd, 5, '合計まで戻している');
});

test('畳んだ記録の id が重ならない', () => {
  let list = [];
  const N = AUDIT_LIMIT + 700;
  for (let i = 0; i < N; i += 1) list = appendAudit(list, makeEntry({ action: 'stepRun', cost: 0.01 }));
  const folded = list.filter((e) => e.action === FOLD_ACTION);
  assert.ok(folded.length >= 2, 'この試験の前提（2回以上畳む）が崩れている');
  assert.equal(new Set(folded.map((e) => e.id)).size, folded.length, 'まとめの id が重複している');
});

test('全件を持っていない時は畳まない（畳んだ元がディスクに残るため）', () => {
  let list = [];
  for (let i = 0; i < AUDIT_LIMIT + 5; i += 1) {
    list = appendAudit(list, makeEntry({ action: 'stepRun' }), { fold: false });
  }
  assert.equal(list.length, AUDIT_LIMIT);
  assert.equal(list.filter((e) => e.action === FOLD_ACTION).length, 0);
});
