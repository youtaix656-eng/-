// 「任せたら月いくら浮くか」の決まりを機械チェックする。
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  makeChore, normalizeChores, choreMonthly, offloadReview, offloadLine, offloadAdvice,
  CHORE_WHO, MAX_CHORES,
} from '../src/lib/offload.js';
import { RISK_QUESTIONS, riskLine, riskReview, normalizeRisks } from '../src/lib/risk.js';
import { makeSettings } from '../src/lib/defaults.js';
import { KEYS } from '../src/lib/storage.js';

const chore = (o) => makeChore({ title: 'x', minutes: 30, timesPerMonth: 10, ...o });

test('作業名が無ければ作らない', () => {
  assert.equal(makeChore({ title: '   ' }), null);
  assert.equal(makeChore({}), null);
});

test('時給が入っていなければ金額を出さない（0と書かない）', () => {
  const m = choreMonthly(chore({}), 0);
  assert.equal(m.hours, 5);
  assert.strictEqual(m.yen, null, '未入力は null。0 にすると「タダの作業」に見える');
  const r = offloadReview({ chores: [chore({})] });
  assert.strictEqual(r.mineYen, null);
  assert.strictEqual(r.netYen, null);
  assert.match(offloadLine(r), /時給を入れると/);
});

test('時給を入れると金額になる', () => {
  const r = offloadReview({ chores: [chore({})], hourlyYen: 2000 });
  assert.equal(r.mineHours, 5);
  assert.equal(r.mineYen, 10000);
});

test('浮いた額は 人件費 − 実際のAI費用', () => {
  const r = offloadReview({
    chores: [chore({ who: 'ai', minutes: 60, timesPerMonth: 5, aiCostYen: 400 })],
    hourlyYen: 1500,
  });
  assert.equal(r.movedHours, 5);
  assert.equal(r.movedYen, 7500);
  assert.equal(r.netYen, 7100);
});

test('売上が入っていなければ利益率を出さない', () => {
  const base = { chores: [chore({ who: 'ai', aiCostYen: 100 })], hourlyYen: 1000 };
  assert.strictEqual(offloadReview(base).marginPct, null);
  assert.equal(offloadReview({ ...base, revenueYen: 100000 }).marginPct, 4.9);
});

test('手元に無い基準（相場・平均・業界）を書かない', () => {
  const src = readFileSync(new URL('../src/lib/offload.js', import.meta.url), 'utf8');
  const advice = offloadAdvice(offloadReview({
    chores: [chore({}), chore({ who: 'ai', aiCostYen: 0 })], hourlyYen: 1200, revenueYen: 50000,
  }));
  const text = advice.map((a) => a.title + a.body).join('') + offloadLine(offloadReview({ chores: [chore({})] }));
  for (const ng of ['業界平均', '相場', '一般的に', '平均的な', '健全']) {
    assert.ok(!text.includes(ng), `画面に出る文に「${ng}」を書かない`);
    // ソース側は「相場は使いません」のような否定形だけ許す
    if (src.includes(ng)) assert.match(src, new RegExp(`${ng}[^。]{0,24}(書かない|使いません|使わない|入れないこと|持たない|ではありません)`));
  }
});

test('時給の初期値に相場を置かない（0＝未入力）', () => {
  const s = makeSettings();
  assert.strictEqual(s.hourlyYen, 0);
  assert.strictEqual(s.monthRevenueYen, 0);
});

test('保存キーが登録されている', () => {
  assert.equal(KEYS.chores, 'ouro:chores');
});

test('件数の上限を超えて保存しない', () => {
  const many = Array.from({ length: MAX_CHORES + 10 }, (_, i) => chore({ title: `t${i}` }));
  assert.equal(normalizeChores(many).length, MAX_CHORES);
});

test('壊れた値でも落ちない', () => {
  assert.deepEqual(normalizeChores(null), []);
  assert.deepEqual(normalizeChores([null, {}, { id: 'a' }]).length, 1);
  assert.equal(choreMonthly(null, 100).hours, 0);
  assert.match(offloadLine(null), /書き出/, '空文字で黙らない（行き止まりを作らない）');
  assert.deepEqual(offloadAdvice(null), []);
  const r = offloadReview({ chores: [{ id: 'a', title: 'x', minutes: 'あ', timesPerMonth: -3 }], hourlyYen: 'ん' });
  assert.equal(r.mineHours, 0);
  assert.strictEqual(r.mineYen, null);
});

test('CHORE_WHO 以外の状態を受け付けない', () => {
  assert.equal(makeChore({ title: 'x', who: 'zzz' }).who, 'me');
  assert.ok(Object.keys(CHORE_WHO).length === 2);
});

test('書き出していない時も行き止まりにしない（次にやることを出す）', () => {
  const a = offloadAdvice(offloadReview({}));
  assert.ok(a.length > 0);
  assert.match(offloadLine(offloadReview({})), /書き出/);
});

// ── 続くかどうかの見立て（risk.js）──

test('見立ての件数を文言に直接書かない', () => {
  const src = readFileSync(new URL('../src/lib/risk.js', import.meta.url), 'utf8');
  // 問いの「件数」だけを見る（「1つ足しておく」のような普通の数え方は対象外）。
  for (const f of ['../src/lib/risk.js', '../src/components/Ventures.jsx']) {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/\d+つ(とも|の問い)/.test(t),
      `${f}：「5つとも」のように数を直接書くと、問いを足した時に画面だけ古い数のまま残る`);
  }
  const empty = riskReview({});
  assert.ok(riskLine(empty).startsWith(`${RISK_QUESTIONS.length}つ`));
});

test('問いは id が重複せず、careWhen が答えの中にある', () => {
  const ids = RISK_QUESTIONS.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const q of RISK_QUESTIONS) {
    assert.ok(['yes', 'no'].includes(q.careWhen), q.id);
    assert.ok(q.q && q.why && q.care, q.id);
    assert.ok(!/やめ(る|た)ほうが|やめてください/.test(q.care), `${q.id}：やめろとは言わない`);
  }
});

test('「同じことをやっている人を見たか」の問いがある（ブレーキ）', () => {
  const q = RISK_QUESTIONS.find((x) => x.id === 'seen');
  assert.ok(q, '走り出す前に一度止まる問いが要る');
  assert.equal(q.careWhen, 'no');
  const r = riskReview({ risks: { seen: 'no' } });
  assert.ok(r.cares.some((x) => x.id === 'seen'));
});

test('答えないままでも先へ進める（既定は unknown）', () => {
  const a = normalizeRisks({ copy: 'よくわからない値' });
  for (const q of RISK_QUESTIONS) assert.equal(a[q.id], 'unknown');
  assert.equal(riskReview({}).answered, 0);
  assert.equal(riskReview({}).total, RISK_QUESTIONS.length);
});

test('採点しない・総合判定を出さない', () => {
  const src = readFileSync(new URL('../src/lib/risk.js', import.meta.url), 'utf8');
  assert.ok(!/score|点数|危険度/.test(src.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')));
});
