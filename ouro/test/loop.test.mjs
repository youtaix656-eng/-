// 回し方（OODA／PDCA）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  LOOP_MODES, OODA_STEPS, PDCA_STEPS, stepsOf, suggestMode,
  makeLoop, loopsOf, openLoop, nextN, advance, stepOf, stepIndex,
  fixOptions, fixById, numbersBlock, loopRequest, loopLine, orientResult, loopStages,
} from '../src/lib/loop.js';
import { makeVenture, normalizeVenture } from '../src/lib/venture.js';
import { FUNNEL_STAGES } from '../src/lib/funnel.js';

const F = (values) => ({ labels: {}, entries: [{ id: 'e', week: 1, values, at: 1 }], updatedAt: 0 });
const STUCK = F({ reach: 3000, read: 150, lead: 10, sale: 1 });

// ── 2つを混ぜない ──
test('段は OODA も PDCA も4つで、AIを呼ぶ段は限られている', () => {
  assert.equal(OODA_STEPS.length, 4);
  assert.equal(PDCA_STEPS.length, 4);
  assert.equal(OODA_STEPS.filter((s) => s.kind === 'ai').length, 1, 'OODAでAIを呼ぶのは1段だけ');
  assert.equal(PDCA_STEPS.filter((s) => s.kind === 'ai').length, 2, 'PDCAでAIを呼ぶのは2段だけ');
  for (const s of [...OODA_STEPS, ...PDCA_STEPS]) {
    assert.ok(['human', 'app', 'ai'].includes(s.kind), s.id);
  }
});

test('観察・情勢判断・意思決定・評価ではAIを呼ばない', () => {
  const noAi = ['observe', 'orient', 'decide', 'check'];
  for (const id of noAi) {
    const s = [...OODA_STEPS, ...PDCA_STEPS].find((x) => x.id === id);
    assert.ok(s, id);
    assert.notEqual(s.kind, 'ai', `${id} でAIを呼んではいけない`);
  }
});

// ── どちらを回すかは機械が導く ──
test('数字が無ければ OODA', () => {
  const r = suggestMode({ venture: { id: 'v' }, funnel: null, deals: [] });
  assert.equal(r.mode, 'ooda');
  assert.equal(r.forced, false);
});

test('数字が2週ぶん貯まっても、売れていなければ OODA', () => {
  const f = { labels: {}, entries: [{ id: 'a', week: 1, values: {}, at: 1 }, { id: 'b', week: 2, values: {}, at: 2 }], updatedAt: 0 };
  assert.equal(suggestMode({ venture: { id: 'v' }, funnel: f, deals: [] }).mode, 'ooda');
});

test('数字が貯まり、売れていれば PDCA', () => {
  const f = { labels: {}, entries: [{ id: 'a', week: 1, values: {}, at: 1 }, { id: 'b', week: 2, values: {}, at: 2 }], updatedAt: 0 };
  const deals = [{ ventureId: 'v', status: 'paid' }];
  assert.equal(suggestMode({ venture: { id: 'v' }, funnel: f, deals }).mode, 'pdca');
});

test('人が選んだ回し方が、機械の判定より優先される', () => {
  const r = suggestMode({ venture: { id: 'v', loopMode: 'pdca' }, funnel: null, deals: [] });
  assert.equal(r.mode, 'pdca');
  assert.equal(r.forced, true);
});

test('選んだ回し方は事業に残る（normalize で消えない）', () => {
  const v = normalizeVenture(makeVenture({ title: 'x', loopMode: 'pdca' }));
  assert.equal(v.loopMode, 'pdca');
  assert.equal(makeVenture({ title: 'x', loopMode: 'zzz' }).loopMode, '');
});

// ── 周回 ──
test('1つの事業で同時に回るのは1周だけ', () => {
  const a = makeLoop({ ventureId: 'v', n: 1 });
  const b = { ...makeLoop({ ventureId: 'v', n: 2 }), closedAt: 1 };
  assert.equal(openLoop([b, a], 'v').id, a.id);
  assert.equal(openLoop([b], 'v'), null);
});

test('周回番号は事業ごとに数える', () => {
  const loops = [makeLoop({ ventureId: 'v', n: 3 }), makeLoop({ ventureId: 'w', n: 9 })];
  assert.equal(nextN(loops, 'v'), 4);
  assert.equal(nextN(loops, 'w'), 10);
  assert.equal(nextN(loops, 'z'), 1);
});

test('段は1つずつ進み、最後まで来たら閉じる', () => {
  let lp = makeLoop({ ventureId: 'v' });
  assert.equal(stepOf(lp).id, 'observe');
  lp = advance(lp); assert.equal(stepOf(lp).id, 'orient');
  lp = advance(lp); assert.equal(stepOf(lp).id, 'decide');
  lp = advance(lp); assert.equal(stepOf(lp).id, 'act');
  assert.equal(lp.closedAt, 0);
  lp = advance(lp);
  assert.ok(lp.closedAt > 0, '最後の段の次で閉じる');
});

test('知らない段・知らないモードは既定へ寄せる', () => {
  assert.equal(makeLoop({ mode: 'zzz' }).mode, 'ooda');
  assert.equal(makeLoop({ stepId: 'zzz' }).stepId, 'observe');
  assert.equal(makeLoop({ n: -5 }).n, 1);
});

test('進めるのは呼ばれた時だけ（自動で進む仕掛けを持たない）', () => {
  const src = readFileSync(new URL('../src/lib/loop.js', import.meta.url), 'utf8');
  assert.ok(!/setTimeout|setInterval/.test(src), '時間で勝手に進めない');
});

// ── 情勢判断（アプリが判定する）──
test('詰まっている段と、その段で直せることを出す', () => {
  const o = orientResult(STUCK);
  assert.equal(o.ready, true);
  assert.equal(o.label, '読ませる');
  assert.equal(o.options.length, 2, '選択肢は2つまで');
});

test('数字が無ければ判定せず、観察へ戻す', () => {
  const o = orientResult(null);
  assert.equal(o.ready, false);
  assert.equal(o.options.length, 0);
  assert.match(o.reason, /観察/);
});

test('どの段にも直せることが用意されている', () => {
  for (const s of FUNNEL_STAGES) {
    const opts = fixOptions(s.id);
    assert.ok(opts.length >= 1 && opts.length <= 2, s.id);
    for (const o of opts) {
      assert.ok(o.roleId && o.why, `${s.id}/${o.id}`);
      assert.ok(fixById(o.id), `${o.id} が引けない`);
    }
  }
});

// ── 依頼文（AIを呼ばずに組み立てる）──
test('AIを呼ばない段では依頼文を作らない', () => {
  let lp = makeLoop({ ventureId: 'v' });
  assert.equal(loopRequest(lp, {}), null);                 // observe
  assert.equal(loopRequest(advance(lp), {}), null);        // orient
  assert.equal(loopRequest(advance(advance(lp)), {}), null); // decide
});

test('OODAの行動：選んだ直し方と、いまの数字が依頼文に入る', () => {
  let lp = makeLoop({ ventureId: 'v' });
  lp = advance(advance(advance({ ...lp, decision: 'read_open', decisionStage: 'read' })));
  const r = loopRequest(lp, { venture: { title: 'テスト事業' }, funnel: STUCK });
  assert.equal(r.roleId, 'writer');
  assert.match(r.request, /テスト事業/);
  assert.match(r.request, /書き出しを変える/);
  assert.match(r.request, /詰まっているのは「読ませる」/);
  assert.match(r.request, /5\.0%/);
  assert.match(r.request, /この1つだけ/);
});

test('PDCAの計画：逆算の数字が依頼文に入る', () => {
  let lp = makeLoop({ ventureId: 'v', mode: 'pdca' });
  const r = loopRequest(lp, {
    venture: { title: 'x', goalMonthlyJpy: 500000, priceJpy: 150000 },
    funnel: STUCK,
    plan: { ready: true, needBuyers: 4 },
  });
  assert.equal(r.roleId, 'strategist');
  assert.match(r.request, /500,000円/);
  assert.match(r.request, /4人/);
  assert.match(r.request, /3つまで/);
  assert.match(r.request, /推測せず/);
});

test('PDCAの改善：採算の結果が依頼文に入る', () => {
  let lp = makeLoop({ ventureId: 'v', mode: 'pdca' });
  lp = advance(advance(advance(lp)));
  assert.equal(stepOf(lp).id, 'act');
  const r = loopRequest(lp, { venture: { title: 'x' }, funnel: STUCK, unit: { black: true, ratio: 12.3, earned: 5000, aiCost: 400 } });
  assert.equal(r.roleId, 'analytics');
  assert.match(r.request, /1円あたり12\.3円/);
  assert.match(r.request, /1つだけ/);
});

test('お金も費用も動いていないものを「赤字」と書かない', () => {
  let lp = makeLoop({ ventureId: 'v', mode: 'pdca' });
  lp = advance(advance(advance(lp)));
  const zero = loopRequest(lp, { venture: { title: 'x' }, funnel: STUCK, unit: { black: false, ratio: null, earned: 0, aiCost: 0 } });
  assert.match(zero.request, /まだお金も費用も動いていない/);
  assert.ok(!/AI費用のほうが多い/.test(zero.request));
  const red = loopRequest(lp, { venture: { title: 'x' }, funnel: STUCK, unit: { black: false, ratio: null, earned: 0, aiCost: 900 } });
  assert.match(red.request, /AI費用のほうが多い/);
});

test('依頼文の組み立てにAIを呼ばない', () => {
  const src = readFileSync(new URL('../src/lib/loop.js', import.meta.url), 'utf8');
  assert.ok(!/runStep|provider|fetch\(/.test(src));
  assert.ok(!src.includes('(?<'), '後読みを使わない');
});

test('数字がまだ無くても、依頼文が壊れない', () => {
  let lp = makeLoop({ ventureId: 'v', mode: 'pdca' });
  const r = loopRequest(lp, { venture: { title: 'x' }, funnel: null, plan: null });
  assert.ok(r.request.includes('まだ記録がありません'));
  assert.match(r.request, /不明/);
});

// ── 表示 ──
test('回していない時は「まだ」と言い、回っていれば今の段を出す', () => {
  assert.match(loopLine(null, null), /まだ1周も/);
  // 済んだ周があるのに「まだ1周も」と言わない（履歴の件数と食い違う）
  assert.match(loopLine(null, null, 1), /2周目を始められます/);
  assert.ok(!/まだ1周も/.test(loopLine(null, null, 3)));
  const lp = makeLoop({ ventureId: 'v' });
  assert.match(loopLine(lp, null), /1\/4「観察」/);
  assert.match(loopLine({ ...lp, closedAt: 1 }, null), /終わりました/);
});

test('段の並びに、済み・いま・これから が付く', () => {
  const lp = advance(makeLoop({ ventureId: 'v' }));
  const st = loopStages(lp);
  assert.deepEqual(st.map((x) => x.state), ['done', 'now', 'todo', 'todo']);
  assert.equal(loopStages(null).length, 4);
});

test('周回は仕事の一覧を持たない（結びつきは片方向）', () => {
  const lp = makeLoop({ ventureId: 'v' });
  assert.equal(lp.taskIds, undefined);
  // コメントでの言及（失敗の再発防止メモ）は除き、**項目としては持たない**ことを見る
  const src = readFileSync(new URL('../src/lib/loop.js', import.meta.url), 'utf8');
  assert.ok(!/taskIds\s*:/.test(src), '周回に taskIds という項目を作らない');
});

test('保存キーが登録され、起動時の一覧にも入っている', () => {
  const st = readFileSync(new URL('../src/lib/storage.js', import.meta.url), 'utf8');
  assert.match(st, /loops: 'ouro:loops'/);
  const us = readFileSync(new URL('../src/lib/useStore.js', import.meta.url), 'utf8');
  assert.match(us, /KEYS\.loops,/);
  assert.match(us, /\n  loops: \[\],/);
});
