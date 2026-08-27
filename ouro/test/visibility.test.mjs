// 「誰を待っているか・役職の負荷・止まっている時間・つまずき集・
//   共有しないと完了にしない・掲示板の棚卸し」のテスト。
//
// 6つとも **AIを1回も呼ばない**のが前提なので、
// ここでは入力（仕事・掲示板）から正しい答えが出るかだけを見る。

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildQueue, waitingOn, blockersOf, worstBlocker } from '../src/lib/queue.js';
import { buildRoleLoad, heaviestRole, BUSY_PER_PERSON } from '../src/lib/load.js';
import { buildStalls, stalledSince, humanDuration, longStalls, NAG_AFTER_MS, HOUR_MS, DAY_MS } from '../src/lib/stall.js';
import {
  addPitfall,
  removePitfall,
  forRole,
  pitfallPrompt,
  cleanError,
  fromFailedStep,
  repeated,
  MAX_PITFALLS,
  READ_LIMIT,
} from '../src/lib/pitfalls.js';
import { buildPromotions, similarity, SAME_AT } from '../src/lib/promote.js';
import { ledgerStateOf, needsShare, buildLedger } from '../src/lib/ledger.js';
import { buildContext } from '../src/lib/memory.js';
import { makePost } from '../src/lib/board.js';

const step = (over = {}) => ({ group: 0, status: 'pending', employeeId: 'e1', employeeName: 'ルナ', roleId: 'researcher', ...over });
const task = (over = {}) => ({ id: 't1', title: '仕事A', status: 'queued', createdAt: Date.now(), steps: [step()], ...over });

// ───────── ② 誰を待っているか ─────────

test('前の番号が終わっていなければ、そこが待たせている', () => {
  const t = task({
    steps: [step({ group: 0, status: 'running' }), step({ group: 1, employeeId: 'e2', employeeName: 'カイ' })],
  });
  assert.equal(blockersOf(t).length, 1);
  const w = waitingOn(t);
  assert.equal(w.employeeId, 'e1');
  assert.equal(w.state, 'running');
});

test('前が詰まっていなければ、次に動く人が「まだ始めていない」', () => {
  const w = waitingOn(task());
  assert.equal(w.state, 'idle');
  assert.equal(w.name, 'ルナ');
});

test('オーナー待ちは社員のせいにしない', () => {
  assert.equal(waitingOn(task({ status: 'awaiting_approval' })).kind, 'owner');
  assert.equal(waitingOn(task({ status: 'on_hold' })).kind, 'owner');
  assert.equal(waitingOn(task({ status: 'failed' })).kind, 'owner');
  assert.equal(waitingOn(task({ status: 'done', decisions: [{ state: 'open' }] })).kind, 'owner');
});

test('待たせている数の多い順に並ぶ／実行中と未着手を混ぜない', () => {
  const q = buildQueue(
    [
      task({ id: 'a', steps: [step({ status: 'running' }), step({ group: 1, employeeId: 'e2', employeeName: 'カイ' })] }),
      task({ id: 'b' }),
      task({ id: 'c' }),
      task({ id: 'd', status: 'awaiting_approval' }),
    ],
    [{ id: 'e1', name: 'ルナ', roleId: 'researcher' }]
  );
  assert.equal(q.blockers.length, 1);
  assert.equal(q.blockers[0].waiting.length, 2);
  assert.equal(q.blockers[0].running.length, 1);
  assert.equal(q.owner.length, 1);
  assert.equal(q.flowing, 1);
});

test('1件だけ待たせているのは「詰まり」と呼ばない', () => {
  const one = buildQueue([task({ id: 'a' })], []);
  assert.equal(worstBlocker(one), null);
  const two = buildQueue([task({ id: 'a' }), task({ id: 'b' })], []);
  assert.ok(worstBlocker(two));
});

test('やることの無い完了と中止は待ち行列に入らない', () => {
  const q = buildQueue([task({ status: 'done', shared: 'x' }), task({ id: 'b', status: 'cancelled' })], []);
  assert.equal(q.blockers.length, 0);
  assert.equal(q.owner.length, 0);
});

test('完了でも判断が残っていれば「あなた待ち」に出す', () => {
  // 完了を先に外すと、判断待ちの仕事が待ち行列から消えてしまう。
  const q = buildQueue([task({ status: 'done', decisions: [{ state: 'open' }] })], []);
  assert.equal(q.owner.length, 1);
  assert.equal(q.owner[0].why, '判断');
});

// ───────── ④ 役職ごとの持ち数 ─────────

test('1人あたりの持ち数を出す', () => {
  const tasks = [
    task({ id: 'a', steps: [step(), step({ employeeId: 'e2' })] }),
    task({ id: 'b', steps: [step()] }),
  ];
  const load = buildRoleLoad(tasks, [
    { id: 'e1', roleId: 'researcher' },
    { id: 'e2', roleId: 'researcher' },
  ]);
  const row = load.rows.find((r) => r.roleId === 'researcher');
  assert.equal(row.people, 2);
  assert.equal(row.open, 3);
  assert.equal(row.perPerson, 1.5);
  assert.equal(row.heavy, false);
});

test('重い役職を見つける', () => {
  const many = Array.from({ length: 10 }, (_, i) => task({ id: `t${i}` }));
  const load = buildRoleLoad(many, [{ id: 'e1', roleId: 'researcher' }]);
  assert.ok(load.rows[0].perPerson > BUSY_PER_PERSON);
  assert.equal(heaviestRole(load).roleId, 'researcher');
});

test('完了した仕事は持ち数に数えない', () => {
  const load = buildRoleLoad([task({ status: 'done', shared: 'x' })], [{ id: 'e1', roleId: 'researcher' }]);
  assert.equal(load.rows[0].open, 0);
  assert.equal(heaviestRole(load), null);
});

test('雇っていないので数に出ない役職を、別に出す', () => {
  const load = buildRoleLoad(
    [task({ unstaffedRoles: ['designer', 'designer'] }), task({ id: 'b', unstaffedRoles: ['designer'] })],
    [{ id: 'e1', roleId: 'researcher' }]
  );
  assert.equal(load.unstaffed[0].roleId, 'designer');
  assert.equal(load.unstaffed[0].count, 3);
});

test('雇った役職は「未雇用」に出さない', () => {
  const load = buildRoleLoad([task({ unstaffedRoles: ['researcher'] })], [{ id: 'e1', roleId: 'researcher' }]);
  assert.equal(load.unstaffed.length, 0);
});

// ───────── ⑧ 止まっている時間 ─────────

test('承認は承認の記録の時刻を使う（より正確）', () => {
  const now = Date.now();
  const t = task({ status: 'awaiting_approval', startedAt: now - HOUR_MS });
  const s = stalledSince(t, [{ taskId: 't1', status: 'pending', createdAt: now - 5 * HOUR_MS }]);
  assert.equal(s.kind, 'approval');
  assert.equal(s.at, now - 5 * HOUR_MS);
});

test('止まっていないものは出さない', () => {
  assert.equal(stalledSince(task({ status: 'running' })), null);
  assert.equal(stalledSince(task({ status: 'done', shared: 'x', decisions: [{ state: 'approved' }] })), null);
});

test('長く止まっている順に並ぶ／合計が出る', () => {
  const now = Date.now();
  const r = buildStalls({
    tasks: [
      task({ id: 'a', status: 'awaiting_approval', startedAt: now - 2 * HOUR_MS }),
      task({ id: 'b', status: 'on_hold', heldAt: now - 3 * DAY_MS }),
    ],
    now,
  });
  assert.equal(r.rows[0].taskId, 'b');
  assert.equal(r.worst.taskId, 'b');
  assert.ok(r.totalMs > 3 * DAY_MS);
  assert.equal(r.counts.hold, 1);
});

test('短い待ちは急かさない', () => {
  const now = Date.now();
  const r = buildStalls({ tasks: [task({ status: 'on_hold', heldAt: now - HOUR_MS })], now });
  assert.equal(r.rows.length, 1);
  assert.equal(longStalls(r).length, 0);
  const long = buildStalls({ tasks: [task({ status: 'on_hold', heldAt: now - NAG_AFTER_MS - 1000 })], now });
  assert.equal(longStalls(long).length, 1);
});

test('時間の言い方', () => {
  assert.equal(humanDuration(30 * 60 * 1000), '30分');
  assert.equal(humanDuration(3 * HOUR_MS), '3時間');
  assert.equal(humanDuration(2 * DAY_MS), '2日');
  assert.equal(humanDuration(-5), '1分');
});

// ───────── ⑪ つまずき集 ─────────

test('同じ失敗は件数ではなく回数で増える', () => {
  let list = [];
  const s = { roleId: 'researcher', error: '出典が見つかりませんでした', employeeName: 'ルナ' };
  list = addPitfall(list, fromFailedStep(s, { title: 'A' }, 'リサーチャー'));
  list = addPitfall(list, fromFailedStep(s, { title: 'B' }, 'リサーチャー'));
  assert.equal(list.length, 1);
  assert.equal(list[0].count, 2);
  assert.equal(repeated(list).length, 1);
});

test('役職が違えば別のつまずき', () => {
  let list = [];
  list = addPitfall(list, fromFailedStep({ roleId: 'researcher', error: '同じ文' }, {}, ''));
  list = addPitfall(list, fromFailedStep({ roleId: 'creator', error: '同じ文' }, {}, ''));
  assert.equal(list.length, 2);
  assert.equal(forRole(list, 'creator').length, 1);
});

test('英語や状態番号だけのエラーは貯めない', () => {
  assert.equal(cleanError('HTTP 500'), '');
  assert.equal(cleanError('   '), '');
  assert.equal(cleanError(null), '');
  assert.equal(fromFailedStep({ roleId: 'x', error: 'timeout' }, {}), null);
  assert.ok(cleanError('APIキーが受け付けられませんでした。'));
});

test('読ませるのは新しい3件だけ', () => {
  let list = [];
  for (let i = 0; i < 6; i += 1) {
    list = addPitfall(list, fromFailedStep({ roleId: 'researcher', error: `失敗の内容${i}です` }, {}, ''));
  }
  assert.equal(forRole(list, 'researcher').length, READ_LIMIT);
  assert.equal(pitfallPrompt(list, 'researcher').split('\n').filter((l) => l.startsWith('- ')).length, READ_LIMIT);
});

test('無ければ何も出さない（無理に作らない）', () => {
  assert.equal(pitfallPrompt([], 'researcher'), '');
});

test('貯めすぎても上限で止まる／消せる', () => {
  let list = [];
  for (let i = 0; i < MAX_PITFALLS + 10; i += 1) {
    list = addPitfall(list, fromFailedStep({ roleId: `r${i}`, error: `失敗の内容${i}です` }, {}, ''));
  }
  assert.equal(list.length, MAX_PITFALLS);
  const id = list[0].id;
  assert.equal(removePitfall(list, id).length, MAX_PITFALLS - 1);
});

test('つまずきが社員のプロンプトに入る', () => {
  const list = addPitfall([], fromFailedStep({ roleId: 'researcher', error: '古い統計を使ってしまいました' }, {}, ''));
  const ctx = buildContext({
    employee: { id: 'e1', roleId: 'researcher' },
    task: { request: 'x' },
    pitfallText: pitfallPrompt(list, 'researcher'),
  });
  assert.ok(ctx.text.includes('古い統計'));
  assert.ok(ctx.layers.some((l) => l.layer === 'pitfall'));
});

// ───────── ㉗ 共有しないと完了にしない ─────────

test('共有が無い完了は「確認待ち」のまま', () => {
  const t = task({ status: 'done', shareAsked: true });
  assert.equal(needsShare(t), true);
  assert.equal(ledgerStateOf(t), 'waiting');
});

test('この仕組みより前に終わった仕事は蒸し返さない', () => {
  // 印（shareAsked）が無いものは「昔の仕事」。過去の完了が全部
  // 「確認待ち」に戻ると、台帳もホームの「今日やること」も壊れる。
  const old = task({ status: 'done', finishedAt: 1 });
  assert.equal(needsShare(old), false);
  assert.equal(ledgerStateOf(old), 'done');
});

test('共有を書けば完了になる', () => {
  assert.equal(ledgerStateOf(task({ status: 'done', shareAsked: true, shared: '統計は2024年版が最新' })), 'done');
});

test('「共有なしでよい」でも完了になる（抜けられない関門を作らない）', () => {
  assert.equal(ledgerStateOf(task({ status: 'done', shareAsked: true, shareWaived: true })), 'done');
});

test('設定で切れる', () => {
  const t = task({ status: 'done', shareAsked: true });
  assert.equal(needsShare(t, false), false);
  assert.equal(ledgerStateOf(t, false), 'done');
  assert.equal(buildLedger([t], { requireShare: false })[0].state, 'done');
});

test('終わっていない仕事に共有を求めない', () => {
  assert.equal(needsShare(task({ status: 'running' })), false);
  assert.equal(needsShare(task({ status: 'failed' })), false);
});

test('台帳の「次の対応」が、共有を書くことだと分かる', () => {
  const row = buildLedger([task({ status: 'done', shareAsked: true })], {})[0];
  assert.equal(row.needsShare, true);
  assert.match(row.nextAction, /共有/);
});

// ───────── ㉚ 掲示板の棚卸し ─────────

test('同じことが2回書かれていたら、ルールの候補にする', () => {
  const now = Date.now();
  const board = [
    { ...makePost({ text: '厚労省の統計は2024年版が最新。古い数字に注意。' }), at: now - 1000 },
    { ...makePost({ text: '厚労省の統計は2024年が最新なので、古い数字に注意すること' }), at: now - 2000 },
  ];
  const p = buildPromotions(board, { now });
  assert.equal(p.length, 1);
  assert.equal(p[0].kind, 'rule');
  assert.equal(p[0].count, 2);
  assert.equal(p[0].postIds.length, 2);
});

test('もうすぐ消える中身のある掲示は、知識の候補にする', () => {
  const now = Date.now();
  const board = [{ ...makePost({ text: 'SNSの投稿は朝がいちばん読まれる傾向があると分かった' }), at: now - 27 * DAY_MS }];
  const p = buildPromotions(board, { now });
  assert.equal(p[0].kind, 'knowledge');
  assert.match(p[0].why, /日で消えます/);
});

test('新しくて1回だけの掲示は、まだ何も勧めない', () => {
  const now = Date.now();
  const board = [{ ...makePost({ text: '今日は調査を1件終えました' }), at: now - 1000 }];
  assert.deepEqual(buildPromotions(board, { now }), []);
});

test('短すぎる掲示は知識に勧めない', () => {
  const now = Date.now();
  const board = [{ ...makePost({ text: '完了しました' }), at: now - 27 * DAY_MS }];
  assert.deepEqual(buildPromotions(board, { now }), []);
});

test('似ているかの判定', () => {
  assert.ok(similarity('厚労省の統計は2024年版が最新', '厚労省の統計は2024年が最新') >= SAME_AT);
  assert.ok(similarity('厚労省の統計', '猫の写真を撮る') < SAME_AT);
});

test('同じ掲示を2つの候補に重複させない', () => {
  const now = Date.now();
  const board = [
    { ...makePost({ text: '古い統計を使わないように注意すること。2024年版が最新です。' }), at: now - 27 * DAY_MS },
    { ...makePost({ text: '古い統計は使わない。最新は2024年版であることに注意。' }), at: now - 27 * DAY_MS },
  ];
  const p = buildPromotions(board, { now });
  const ids = p.flatMap((x) => x.postIds);
  assert.equal(new Set(ids).size, ids.length);
});

// ───────── 検査で見つかった不具合の再発防止 ─────────

test('つまずきは「実行の結果」からエラーを取る（手順の写しからではない）', () => {
  // 実行中の手順オブジェクトは実行前の写しなので、error はまだ null。
  // そのまま渡すと、失敗しているのにつまずきが1件も貯まらない（実際に起きた）。
  const running = { roleId: 'researcher', status: 'running', error: null, employeeName: 'ルナ' };
  assert.equal(fromFailedStep(running, { title: 'A' }, 'リサーチャー'), null);

  const result = { error: 'Claude：呼び出しが多すぎます。少し時間をおいてからやり直してください。（429）' };
  const made = fromFailedStep({ ...running, error: result.error }, { title: 'A' }, 'リサーチャー');
  assert.ok(made);
  assert.match(made.text, /呼び出しが多すぎます/);
  assert.equal(made.roleId, 'researcher');
});
