// 不労所得まわり：手離れ・1件あたりの採算・続くかどうかの見立て・「稼げる」の見張り。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { lastTouchedAt, earnedSince, passiveState, passiveLine, finishNudge, REST_DAYS } from '../src/lib/passive.js';
import { unitEconomics, unitLine, costAdvice } from '../src/lib/unit.js';
import { RISK_QUESTIONS, RISK_ANSWERS, normalizeRisks, riskReview, riskLine } from '../src/lib/risk.js';
import { checkPromises } from '../src/lib/guard.js';
import { makeVenture } from '../src/lib/venture.js';

const DAY = 86400000;
const V = { id: 'v1', priceJpy: 1980 };

// ── 手離れ ──
test('手を入れた時刻は 依頼・発信・案件を起こした 日付から取る', () => {
  const now = Date.now();
  const last = lastTouchedAt(V, {
    tasks: [{ ventureId: 'v1', createdAt: now - 10 * DAY }],
    posts: [{ ventureId: 'v1', postedAt: now - 3 * DAY }],
    deals: [{ ventureId: 'v1', createdAt: now - 20 * DAY }],
  });
  assert.equal(last, now - 3 * DAY);
});

test('別の事業の記録は数えない', () => {
  assert.equal(lastTouchedAt(V, { tasks: [{ ventureId: 'other', createdAt: Date.now() }] }), 0);
});

test('入金の記録は「手を入れた」に数えない（数えると不労所得が永久に測れない）', () => {
  const now = Date.now();
  // 30日前に案件を起こし、きのう入金された
  const deals = [{ ventureId: 'v1', status: 'paid', fee: 5000, createdAt: now - 30 * DAY, updatedAt: now - DAY, paidAt: now - DAY }];
  const p = passiveState({ venture: V, deals, now });
  assert.equal(p.days, 30);
  assert.equal(p.state, 'passive');
  assert.equal(p.earned, 5000);
});

test('事業の説明を直しただけでは日数が0に戻らない', () => {
  const now = Date.now();
  const venture = { ...V, updatedAt: now };
  const p = passiveState({ venture, tasks: [{ ventureId: 'v1', createdAt: now - 12 * DAY }], now });
  assert.equal(p.days, 12);
});

test('手を離して間もないうちは building（作るまでは労働）', () => {
  const now = Date.now();
  const p = passiveState({ venture: V, posts: [{ ventureId: 'v1', postedAt: now - (REST_DAYS - 1) * DAY }], now });
  assert.equal(p.state, 'building');
});

test('手を止めていてもお金が入っていなければ resting', () => {
  const now = Date.now();
  const p = passiveState({ venture: V, posts: [{ ventureId: 'v1', postedAt: now - 20 * DAY }], now });
  assert.equal(p.state, 'resting');
  assert.equal(p.earned, 0);
  assert.match(passiveLine(p), /0円/);
});

test('記録が1つも無ければ none（勝手に不労所得にしない）', () => {
  const p = passiveState({ venture: V });
  assert.equal(p.state, 'none');
  assert.equal(p.days, 0);
});

test('手を入れる前に入った入金は「そのあいだに入ったお金」に数えない', () => {
  const now = Date.now();
  const deals = [{ ventureId: 'v1', status: 'paid', fee: 1000, createdAt: now - 40 * DAY, paidAt: now - 30 * DAY }];
  assert.equal(earnedSince(V, deals, now - 10 * DAY), 0);
  assert.equal(earnedSince(V, deals, now - 40 * DAY), 1000);
});

test('入金済み以外は数えない', () => {
  const now = Date.now();
  const deals = [{ ventureId: 'v1', status: 'delivered', fee: 1000, createdAt: now - 40 * DAY, paidAt: now - DAY }];
  assert.equal(earnedSince(V, deals, now - 30 * DAY), 0);
});

// ── 仕上げ線 ──
test('仕上げ線が無ければ、決めるようにすすめる', () => {
  const p = passiveState({ venture: V });
  assert.match(finishNudge(V, p), /手を止める/);
});

test('手を止めたあとも、決めた線は消さずに見せる', () => {
  const v = { ...V, finishWhen: '月3万', restedAt: Date.now() };
  const p = passiveState({ venture: v });
  const line = finishNudge(v, p);
  assert.match(line, /決めた事業/);
  assert.match(line, /月3万/);
});

test('makeVenture が見立て・仕上げ線・手を止めた印を持つ', () => {
  const v = makeVenture({ title: 'x', risks: { copy: 'yes', bogus: 'zzz' }, finishWhen: 'a'.repeat(300) });
  assert.equal(v.risks.copy, 'yes');
  assert.equal(v.risks.platform, 'unknown');
  assert.equal(v.risks.bogus, undefined);
  assert.equal(v.finishWhen.length, 120);
  assert.equal(v.restedAt, 0);
});

// ── 1件あたりの採算 ──
test('稼ぎがAI費用を上回っていれば黒', () => {
  const u = unitEconomics({
    venture: V,
    deals: [{ id: 'd1', ventureId: 'v1', status: 'paid', fee: 1980 }],
    tasks: [{ ventureId: 'v1', totalCost: 0.01 }],
    usdJpy: 155,
  });
  assert.equal(u.sales, 1);
  assert.equal(u.perSale, 1980);
  assert.ok(u.black);
});

test('売れていなければ 1件あたりは出さない（0で割らない・1と置かない）', () => {
  const u = unitEconomics({ venture: V, deals: [], tasks: [{ ventureId: 'v1', totalCost: 0.1 }] });
  assert.equal(u.perSale, null);
  assert.equal(u.costPerSale, null);
  assert.equal(u.marginPerSale, null);
  assert.equal(u.black, false);
});

test('値段が分からなければ損益分岐を出さない', () => {
  const u = unitEconomics({ venture: { id: 'v1' }, deals: [], tasks: [{ ventureId: 'v1', totalCost: 1 }] });
  assert.equal(u.breakEven, null);
  assert.equal(u.remaining, null);
});

test('案件に紐づいた仕事の費用も、この事業の費用に入る', () => {
  const u = unitEconomics({
    venture: V,
    deals: [{ id: 'd1', ventureId: 'v1', status: 'paid', fee: 3000 }],
    tasks: [{ dealId: 'd1', totalCost: 0.02 }],
    usdJpy: 100,
  });
  assert.equal(u.aiCost, 2);
});

test('同じ仕事を二重に数えない', () => {
  const u = unitEconomics({
    venture: V,
    deals: [{ id: 'd1', ventureId: 'v1', status: 'paid', fee: 3000 }],
    tasks: [{ ventureId: 'v1', dealId: 'd1', totalCost: 0.1 }],
    usdJpy: 100,
  });
  assert.equal(u.aiCost, 10);
});

test('赤のときは手を出すが、やめろとは言わない', () => {
  const u = unitEconomics({ venture: V, deals: [], tasks: [{ ventureId: 'v1', totalCost: 0.5 }], usdJpy: 155 });
  const tips = costAdvice(u, {});
  assert.ok(tips.some((t) => t.id === 'cheap'));
  assert.ok(!tips.some((t) => /やめ|中止/.test(t.text)));
});

test('すでに安いモデルなら、その案内は出さない', () => {
  const u = unitEconomics({ venture: V, deals: [], tasks: [{ ventureId: 'v1', totalCost: 0.5 }] });
  assert.ok(!costAdvice(u, { costMode: 'cheap' }).some((t) => t.id === 'cheap'));
});

test('黒のときは手を出さない', () => {
  const u = unitEconomics({ venture: V, deals: [{ id: 'd', ventureId: 'v1', status: 'paid', fee: 9999 }], tasks: [] });
  assert.equal(costAdvice(u, {}), null);
});

test('画面に出す文が、業界平均のような外の基準を持ち出さない', () => {
  const texts = [];
  for (const deals of [[], [{ id: 'd', ventureId: 'v1', status: 'paid', fee: 1980 }]]) {
    for (const cost of [0, 0.5]) {
      const u = unitEconomics({ venture: V, deals, tasks: [{ ventureId: 'v1', totalCost: cost }] });
      texts.push(unitLine(u));
      for (const t of costAdvice(u, {}) || []) texts.push(t.text);
    }
  }
  for (const t of texts) assert.ok(!/業界|相場|平均|一般的/.test(t), t);
});

// ── 続くかどうかの見立て ──
test('既定は全部わからない', () => {
  const r = riskReview({});
  assert.equal(r.answered, 0);
  assert.equal(r.unanswered.length, RISK_QUESTIONS.length);
  assert.equal(r.cares.length, 0);
});

test('気をつける側に答えた問いだけが cares に出る', () => {
  const r = riskReview({ risks: { copy: 'yes', platform: 'no', terms: 'yes', liked: 'yes', mine: 'yes' } });
  assert.deepEqual(r.cares.map((c) => c.id), ['copy']);
  assert.equal(r.answered, 5);
});

test('気をつける所には、必ず「その時にできること」が付く', () => {
  for (const q of RISK_QUESTIONS) {
    assert.ok(q.care && q.care.length > 5, q.id);
    assert.ok(['yes', 'no'].includes(q.careWhen), q.id);
  }
});

test('点数・総合判定を出さない', () => {
  const r = riskReview({ risks: { copy: 'yes', platform: 'yes', terms: 'no', liked: 'no', mine: 'no' } });
  assert.equal(r.score, undefined);
  assert.equal(r.verdict, undefined);
  assert.ok(!/点|スコア|危険度/.test(riskLine(r)));
});

test('知らない答えは わからない に寄せる', () => {
  assert.equal(normalizeRisks({ copy: 'maybe' }).copy, 'unknown');
  assert.deepEqual(Object.keys(RISK_ANSWERS), ['yes', 'no', 'unknown']);
});

test('見立ての中に「プラットフォームに嫌われる＝人に嫌われる」が入っている', () => {
  const liked = RISK_QUESTIONS.find((q) => q.id === 'liked');
  assert.ok(liked);
  assert.match(liked.why, /嫌われ/);
});

// ── 「稼げる」の見張り ──
test('稼ぎ方の言い切りを拾う', () => {
  const hits = checkPromises('誰でも簡単に稼げます。放置していても収入が入ります。月30万円稼げます。リスクはゼロ。不労所得になります。');
  const labels = hits.map((h) => h.label);
  assert.ok(labels.includes('「稼げる」の言い切り'));
  assert.ok(labels.includes('「何もしなくても増える」'));
  assert.ok(labels.includes('金額の言い切り'));
  assert.ok(labels.includes('「リスクが無い」という表現'));
  assert.ok(labels.includes('「不労所得になる」の言い切り'));
});

test('ふつうの文では鳴らない', () => {
  assert.deepEqual(checkPromises('腰痛のセルフケアを紹介します。合う合わないがあるので、痛みが強い時は受診してください。'), []);
  assert.deepEqual(checkPromises('不労所得という言葉について考えてみます。稼げるかどうかは人によります。'), []);
});

test('見張りに後読み（lookbehind）を使わない（古いSafariで落ちる）', () => {
  const src = readFileSync(new URL('../src/lib/guard.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('(?<'));
});
