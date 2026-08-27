import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makeVenture, canStart, activeVenture, dayIndex, daysLeft, ventureStats, sortVentures, VENTURE_STATES,
} from '../src/lib/venture.js';
import { targetPlan, targetLine, targetRequest } from '../src/lib/target.js';
import { verdictStatus, applyDecision, verdictLine, VERDICT_METRICS } from '../src/lib/verdict.js';
import { todayPlan, practiceDays, SLOTS, todayLine } from '../src/lib/daily.js';
import { makePost, addPost, removePost, postsOf, postsOn, postStats, weekDraft, MAX_POSTS } from '../src/lib/posts.js';
import { prepublishChecks, prepublishLine } from '../src/lib/prepublish.js';
import { originOf, trustOf, ingestOne, INGEST_KINDS } from '../src/lib/ingest.js';
import { ORIGINS, SOURCE_TYPES } from '../src/lib/knowledge.js';
import { createTask } from '../src/lib/workflow.js';
import { createDeal } from '../src/lib/revenue.js';
import { startOfWeek } from '../src/lib/funnel.js';

const DAY = 86400000;

// ── 事業 ──

test('事業は既定で検討中。実行中で作った時だけ日数を数え始める', () => {
  const v = makeVenture({ title: 'テスト' });
  assert.equal(v.state, 'idea');
  assert.equal(v.startedAt, null);
  const r = makeVenture({ title: '走る', state: 'running' });
  assert.ok(r.startedAt > 0);
});

test('実行中にできるのは1つだけ（選択と集中）', () => {
  const a = makeVenture({ title: 'A', state: 'running' });
  const b = makeVenture({ title: 'B' });
  const list = [a, b];
  assert.equal(canStart(list, b.id).ok, false);
  assert.equal(canStart(list, b.id).blocker.id, a.id);
  // 自分自身は数えない（実行中のものをもう一度実行中にしてもよい）
  assert.equal(canStart(list, a.id).ok, true);
  // 休止にすれば通る
  assert.equal(canStart([{ ...a, state: 'paused' }, b], b.id).ok, true);
});

test('activeVenture は実行中を1つ返す', () => {
  assert.equal(activeVenture([{ state: 'idea' }, { state: 'running', id: 'x' }]).id, 'x');
  assert.equal(activeVenture([{ state: 'idea' }]), null);
});

test('日数は1日目から数える。残り日数は超過でマイナス', () => {
  const now = Date.now();
  const v = makeVenture({ state: 'running', days: 30 });
  v.startedAt = now - 3 * DAY;
  assert.equal(dayIndex(v, now), 4);
  assert.equal(daysLeft(v, now), 27);
  v.startedAt = now - 40 * DAY;
  assert.ok(daysLeft(v, now) < 0);
});

test('事業の数字は仕事と案件の側から数える（事業に一覧を持たない）', () => {
  const v = makeVenture({ title: 'V', state: 'running' });
  const deal = { ...createDeal({ title: 'D', fee: 30000, status: 'paid' }), ventureId: v.id };
  const tasks = [
    { id: 't1', ventureId: v.id, dealId: deal.id, totalCost: 0.1, status: 'done', result: { knowledgeIds: ['k1'] } },
    { id: 't2', ventureId: v.id, dealId: null, totalCost: 0.2, status: 'running', result: {} },
    { id: 't3', ventureId: 'other', dealId: null, totalCost: 5, status: 'done', result: {} },
  ];
  const s = ventureStats({ venture: v, tasks, deals: [deal], knowledge: [{ id: 'k1' }], usdJpy: 100 });
  assert.equal(s.taskCount, 2);
  assert.equal(s.doneCount, 1);
  assert.equal(s.earned, 30000);
  // 案件ぶん 0.1*100 ＋ 案件に紐づかない 0.2*100
  assert.equal(s.aiCost, 30);
  assert.equal(s.net, 29970);
  assert.equal(s.knowledgeCount, 1);
});

test('並びは実行中がいちばん上', () => {
  const rows = sortVentures([
    { id: 'a', state: 'stopped', updatedAt: 3 },
    { id: 'b', state: 'running', updatedAt: 1 },
    { id: 'c', state: 'idea', updatedAt: 2 },
  ]);
  assert.deepEqual(rows.map((r) => r.id), ['b', 'c', 'a']);
});

test('仕事と案件は ventureId を持つ（結びつきは片方向だけ）', () => {
  const t = createTask({ request: 'あ', ventureId: 'v1' });
  assert.equal(t.ventureId, 'v1');
  assert.equal(createTask({ request: 'あ' }).ventureId, null);
  assert.equal(createDeal({ title: 'd', ventureId: 'v1' }).ventureId, 'v1');
  // 事業の側に taskIds を持たない
  assert.equal('taskIds' in makeVenture({}), false);
});

// ── 逆算 ──

test('逆算：目標と単価が無ければ計算しない', () => {
  const p = targetPlan({ venture: makeVenture({}) });
  assert.equal(p.ready, false);
  assert.match(targetLine(p), /目標額と単価/);
});

test('逆算：通過率から各段の必要人数を出す', () => {
  const v = makeVenture({ priceJpy: 1980, goalMonthlyJpy: 100000 });
  const entry = { values: { reach: 1000, read: 200, lead: 40, sale: 4 } };
  const p = targetPlan({ venture: v, entry });
  assert.equal(p.needBuyers, 51);
  const need = Object.fromEntries(p.rows.map((r) => [r.stageId, r.need]));
  assert.equal(need.sale, 51);
  assert.equal(need.lead, 510);
  assert.equal(need.read, 2550);
  assert.equal(need.reach, 12750);
  assert.equal(p.unknown.length, 0);
});

test('逆算：通過率が分からない段は埋めずに null にする（1と置いて嘘をつかない）', () => {
  const v = makeVenture({ priceJpy: 1000, goalMonthlyJpy: 10000 });
  const p = targetPlan({ venture: v, entry: null });
  assert.equal(p.needBuyers, 10);
  assert.equal(p.rows.find((r) => r.stageId === 'sale').need, 10);
  assert.equal(p.rows.find((r) => r.stageId === 'lead').need, null);
  assert.deepEqual(p.unknown, ['reach', 'read', 'lead']);
});

test('逆算：手元にない基準（業界平均）を文章に出さない', () => {
  const v = makeVenture({ title: 'V', priceJpy: 1000, goalMonthlyJpy: 10000 });
  const entry = { values: { reach: 100, read: 50, lead: 10, sale: 1 } };
  const req = targetRequest(v, targetPlan({ venture: v, entry }), null);
  assert.match(req, /手元にない数字/);
  assert.doesNotMatch(req, /業界平均は|一般的には[0-9]/);
});

// ── やめる基準 ──

test('やめる基準：決めていなければ none', () => {
  const st = verdictStatus(makeVenture({}), null);
  assert.equal(st.state, 'none');
  assert.match(verdictLine(st), /やめる基準がまだ/);
});

test('やめる基準：期日前でも届いたら met、期日が来て未達なら due', () => {
  const now = Date.now();
  const base = makeVenture({ state: 'running', days: 30, verdict: { metric: 'lead', target: 10 } });
  base.startedAt = now - 3 * DAY;
  const funnel = { entries: [{ id: 'w', weekStart: 0, values: { lead: 12 } }] };
  assert.equal(verdictStatus(base, funnel, now).state, 'met');
  assert.equal(verdictStatus(base, { entries: [{ id: 'w', values: { lead: 1 } }] }, now).state, 'running');
  const over = { ...base, startedAt: now - 40 * DAY };
  assert.equal(verdictStatus(over, { entries: [{ id: 'w', values: { lead: 1 } }] }, now).state, 'due');
});

test('やめる基準：判断すると状態が変わる。延長は判断を残さず期間だけ伸ばす', () => {
  const v = makeVenture({ state: 'running', days: 30, verdict: { metric: 'lead', target: 10 } });
  assert.equal(applyDecision(v, 'stop').state, 'stopped');
  assert.equal(applyDecision(v, 'continue').state, 'keep');
  const ext = applyDecision(v, 'extend', 14);
  assert.equal(ext.days, 44);
  assert.equal(ext.verdict.decidedAt, 0);
  assert.equal(ext.state, 'running');
});

test('やめる基準に使えるのは収益導線の4段だけ', () => {
  assert.deepEqual(VERDICT_METRICS.map((m) => m.id), ['reach', 'read', 'lead', 'sale']);
});

// ── 今日やる1つ ──

test('今日やる1つ：3つの枠は増やさない', () => {
  assert.equal(SLOTS.length, 3);
  assert.deepEqual(SLOTS.map((s) => s.id), ['share', 'build', 'count']);
});

test('今日やる1つ：読み込みが済むまで「やっていない」と言い切らない', () => {
  const v = makeVenture({ state: 'running' });
  const plan = todayPlan({ venture: v, posts: [], tasks: [], loaded: false });
  assert.ok(plan.items.every((i) => i.unknown));
  assert.equal(todayLine(plan), '確認中…');
});

test('今日やる1つ：やったことは済みになる', () => {
  const now = Date.now();
  const v = makeVenture({ state: 'running' });
  const posts = [makePost({ ventureId: v.id, title: 'a', postedAt: now, reach: 5 })];
  const tasks = [{ id: 't', createdAt: now }];
  const plan = todayPlan({ venture: v, posts, tasks, loaded: true, now });
  assert.equal(plan.doneCount, 3);
  assert.equal(plan.next, null);
});

test('通算の実践日数は連続日数ではない（休んだ日があっても減らない）', () => {
  const now = Date.now();
  const posts = [
    makePost({ postedAt: now }),
    makePost({ postedAt: now - 5 * DAY }),
    makePost({ postedAt: now - 5 * DAY }), // 同じ日は1日
  ];
  assert.equal(practiceDays(posts, [], now), 2);
  // 未来の日付は数えない
  assert.equal(practiceDays([makePost({ postedAt: now + 10 * DAY })], [], now), 0);
});

test('今日やる1つの文章に「連続」を出さない', () => {
  const v = makeVenture({ state: 'running', days: 30 });
  const line = todayLine(todayPlan({ venture: v, posts: [], tasks: [], loaded: true }));
  assert.doesNotMatch(line, /連続/);
});

// ── 発信ログ ──

test('発信ログ：新しい順に並び、上限で切る', () => {
  let posts = [];
  for (let i = 0; i < MAX_POSTS + 5; i += 1) {
    posts = addPost(posts, makePost({ title: `p${i}`, postedAt: 1000 + i }));
  }
  assert.equal(posts.length, MAX_POSTS);
  assert.equal(posts[0].title, `p${MAX_POSTS + 4}`);
});

test('発信ログ：同じ id は置き換える・消せる・事業でしぼれる', () => {
  const a = makePost({ ventureId: 'v1', title: 'a' });
  const b = makePost({ ventureId: 'v2', title: 'b' });
  let posts = addPost(addPost([], a), b);
  assert.equal(posts.length, 2);
  posts = addPost(posts, { ...a, title: 'a2' });
  assert.equal(posts.length, 2);
  assert.equal(postsOf(posts, 'v1')[0].title, 'a2');
  assert.equal(postsOf(posts).length, 2);
  assert.equal(removePost(posts, a.id).length, 1);
});

test('発信ログ：反応の数字は推測で埋めない（既定は0）', () => {
  const p = makePost({ title: 'a' });
  assert.equal(p.reach, 0);
  assert.equal(p.reaction, 0);
  assert.equal(p.lead, 0);
  assert.equal(makePost({ reach: -5 }).reach, 0);
});

test('発信ログ：今週ぶんの下書きを作る。売れた数は埋めない', () => {
  const ws = startOfWeek(Date.now());
  const posts = [makePost({ postedAt: ws + DAY, reach: 100, reaction: 20, lead: 3 })];
  const d = weekDraft(posts, ws);
  assert.equal(d.reach, 100);
  assert.equal(d.read, 20);
  assert.equal(d.lead, 3);
  assert.equal(d.sale, 0);
  assert.equal(d.count, 1);
});

test('発信ログ：今日ぶんと直近の集計', () => {
  const now = Date.now();
  const posts = [makePost({ postedAt: now }), makePost({ postedAt: now - 10 * DAY })];
  assert.equal(postsOn(posts, now).length, 1);
  assert.equal(postStats(posts, 7, now).count, 1);
});

// ── 出す前チェック ──

test('出す前チェック：止めるのは個人情報だけ', () => {
  const r = prepublishChecks({ text: '連絡は 090-1234-5678 まで。' });
  assert.equal(r.blocked, true);
  assert.equal(r.worst, 'stop');
  assert.match(prepublishLine(r), /個人情報/);

  const w = prepublishChecks({ text: '3日で納品します。' });
  assert.equal(w.blocked, false);
  assert.equal(w.worst, 'warn');
});

test('出す前チェック：当たらなくても項目は返す（確かめたことが分かるように）', () => {
  const r = prepublishChecks({ text: 'ふつうの文章です。' });
  const ids = r.items.map((i) => i.id);
  assert.deepEqual(ids, ['personal', 'checks', 'promise', 'respect', 'opening', 'outline']);
  assert.equal(r.worst, 'ok');
});

test('出す前チェック：伏せた形で出す（元の番号をそのまま画面に出さない）', () => {
  const r = prepublishChecks({ text: '電話は 090-1234-5678 です。' });
  const hit = r.items.find((i) => i.id === 'personal').hits[0];
  assert.doesNotMatch(hit.phrase, /1234/);
});

test('出す前チェック：完成条件を決めていない仕事は skip（未達と混ぜない）', () => {
  const t = createTask({ request: 'あ' });
  const r = prepublishChecks({ text: 'あ', task: t });
  assert.equal(r.items.find((i) => i.id === 'checks').level, 'skip');
});

// ── 取り込みの来歴 ──

test('取り込み：AIに書かせたものは来歴 ai（メモと混ぜない）', () => {
  assert.equal(originOf('ai'), 'ai');
  assert.equal(originOf('note'), 'user');
  assert.equal(originOf('audio'), 'user');
  assert.equal(originOf('web'), 'external');
  assert.equal(originOf('pdf'), 'external');
  assert.ok(trustOf('ai') < trustOf('note'));

  const { knowledge, source } = ingestOne({ kind: 'ai', title: 'T', text: '本文' });
  assert.equal(knowledge.origin, 'ai');
  assert.equal(source.type, 'ai');
});

test('取り込み：どの種類も、来歴と出典の名前を持っている', () => {
  for (const k of INGEST_KINDS) {
    assert.ok(ORIGINS[originOf(k.id)], `${k.id} の来歴名が無い`);
    assert.ok(SOURCE_TYPES[k.id], `${k.id} の出典名が無い`);
  }
});

// ── 起動時の読み込み漏れを機械チェックする ──
//
// FIRST_KEYS に足したのに読み込み側の一覧へ書き忘れると、
// 作ったものが再起動のたびに消える（事業で実際に踏んだ）。
// 一覧を手で持たない作りになっていることを、ここで見張る。

import { readFileSync } from 'node:fs';
import { KEYS } from '../src/lib/storage.js';

const storeSrc = readFileSync(new URL('../src/lib/useStore.js', import.meta.url), 'utf8');

function keyList(name) {
  const m = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`).exec(storeSrc);
  if (!m) return [];
  return [...m[1].matchAll(/KEYS\.(\w+)/g)].map((x) => x[1]);
}

test('起動時に読むキーは、すべて空の初期値を持っている', () => {
  const empty = /const EMPTY = \{([\s\S]*?)\n\};/.exec(storeSrc)[1];
  const names = new Set([...empty.matchAll(/^\s{2}(\w+):/gm)].map((x) => x[1]));
  for (const k of [...keyList('FIRST_KEYS'), ...keyList('REST_KEYS')]) {
    if (k === 'seeded') continue;
    assert.ok(names.has(k), `EMPTY に ${k} が無い`);
    assert.ok(KEYS[k], `KEYS に ${k} が無い`);
  }
});

test('最初のひと組の読み込みは手書きの一覧を持たない（FIRST_KEYS から回す）', () => {
  assert.match(storeSrc, /for \(const key of FIRST_KEYS\) \{/);
});

test('事業と発信ログは保存キーに登録されている', () => {
  assert.equal(KEYS.ventures, 'ouro:ventures');
  assert.equal(KEYS.posts, 'ouro:posts');
  assert.ok(keyList('FIRST_KEYS').includes('ventures'));
  assert.ok(keyList('REST_KEYS').includes('posts'));
});
