import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOMAINS, DOMAIN_MAP, FRAMING, FERMENTS, FIBERS, SLEEP_HYGIENE, ANXIETY_ACTIONS, SOCIAL_OPTIONS,
  emptyCondition, conditionOf, domainDone, fermentVariety, weeklyCondition, weakestDomain,
  NATURE_MINUTES_TARGET,
} from '../src/lib/condition.js';
import type { ConditionRecord, DayRecord } from '../src/types/index.js';

function day(date: string, condition?: Partial<ConditionRecord>, extra: Partial<DayRecord> = {}): DayRecord {
  return {
    date, checked: [], declaration: '', note: '', shift: null, shiftEndsAt: null, sleep: null, updatedAt: 0,
    condition: condition ? { ...emptyCondition(), ...condition } : undefined,
    ...extra,
  };
}
const map = (list: DayRecord[]) => Object.fromEntries(list.map((d) => [d.date, d]));
const WEEK = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'];

test('6つの領域がそろっていて、読みと理由を持つ', () => {
  assert.equal(DOMAINS.length, 6);
  assert.deepEqual(DOMAINS.map((d) => d.id), ['gut', 'nature', 'sleep', 'social', 'anxiety', 'rules']);
  for (const d of DOMAINS) {
    assert.ok(d.title && d.reading && d.icon, `${d.id} に項目が足りない`);
    assert.ok(d.why.length > 30, `${d.id} に理由が要る`);
  }
  assert.equal(DOMAIN_MAP.gut.title, '腸内環境');
});

test('炎症は説明として持ち、点数にはしない', () => {
  assert.match(FRAMING.inflammation.body, /火事/);
  assert.match(FRAMING.inflammation.caution, /判定しません/);
  // 「スコア」「点」を返す関数がないこと（この層で数値化しない）
  const mod = Object.keys({ emptyCondition, conditionOf, domainDone, fermentVariety, weeklyCondition, weakestDomain });
  assert.equal(mod.some((n) => /score|点数/i.test(n)), false);
});

test('文明病の説明に「意思の力だけでは続かない」前提が入っている', () => {
  assert.match(FRAMING.civilization.body, /600万年|六百万年/);
  assert.match(FRAMING.civilization.body, /意思の力/);
});

test('記録が無くても既定値で読める（古いデータでも落ちない）', () => {
  const c = conditionOf(undefined);
  assert.deepEqual(c, emptyCondition());
  assert.deepEqual(conditionOf(day('2026-08-30')), emptyCondition());
  for (const d of DOMAINS) assert.equal(domainDone(undefined, d.id), false);
});

test('腸：発酵食品か食物繊維のどちらかがあれば置けた日', () => {
  assert.equal(domainDone(day('x', { ferments: ['納豆'] }), 'gut'), true);
  assert.equal(domainDone(day('x', { fibers: ['海藻'] }), 'gut'), true);
  assert.equal(domainDone(day('x', {}), 'gut'), false);
});

test('自然：外で10分以上、または室内の自然', () => {
  assert.equal(domainDone(day('x', { natureMinutes: NATURE_MINUTES_TARGET }), 'nature'), true);
  assert.equal(domainDone(day('x', { natureMinutes: 5 }), 'nature'), false);
  assert.equal(domainDone(day('x', { natureMinutes: 5, indoorNature: ['観葉植物'] }), 'nature'), true);
});

test('睡眠：習慣のチェックか、就寝の記録があれば置けた日', () => {
  assert.equal(domainDone(day('x', { sleepHygiene: ['bed_only'] }), 'sleep'), true);
  assert.equal(
    domainDone(day('x', {}, { sleep: { actualAt: '23:00', crossesMidnight: false, recordedAt: 0 } }), 'sleep'),
    true,
  );
  assert.equal(domainDone(day('x', {}), 'sleep'), false);
});

test('人間関係：軽い接点でも置けた日にする（深い接点だけを条件にしない）', () => {
  assert.equal(domainDone(day('x', { social: 'deep' }), 'social'), true);
  assert.equal(domainDone(day('x', { social: 'light' }), 'social'), true);
  assert.equal(domainDone(day('x', { social: 'none' }), 'social'), false);
  assert.equal(domainDone(day('x', { social: null }), 'social'), false);
});

test('不安：感じなかった日も、対処した日も「置けた」（不安を感じたこと自体を責めない）', () => {
  assert.equal(domainDone(day('x', { anxietyFelt: false }), 'anxiety'), true);
  assert.equal(domainDone(day('x', { anxietyFelt: true, anxietyActions: ['cosmos'] }), 'anxiety'), true);
  assert.equal(domainDone(day('x', { anxietyFelt: true }), 'anxiety'), false);
  // 瞑想を記録した日も対処にあたる（同じことを2回チェックさせない）
  assert.equal(
    domainDone(day('x', { anxietyFelt: true }, { meditations: [{ minutes: 10, recordedAt: 0 }] }), 'anxiety'),
    true,
  );
});

test('3のルールはこの層では判定しない（threeRules.ts が持つ）', () => {
  assert.equal(domainDone(day('x', { ferments: ['納豆'] }), 'rules'), false);
});

test('発酵食品は「種類」を数える（同じものを何度食べても1種類）', () => {
  const days = map([
    day('2026-08-24', { ferments: ['納豆', 'ヨーグルト'] }),
    day('2026-08-25', { ferments: ['納豆'] }),
    day('2026-08-26', { ferments: ['キムチ'] }),
  ]);
  const kinds = fermentVariety(days, WEEK);
  assert.equal(kinds.length, 3);
  assert.deepEqual([...kinds].sort(), ['キムチ', 'ヨーグルト', '納豆']);
});

test('週の集計は「何日置けたか」だけを返す（合計点を返さない）', () => {
  const days = map([
    day('2026-08-24', { ferments: ['納豆'], natureMinutes: 15, social: 'deep' }),
    day('2026-08-25', { fibers: ['海藻'], social: 'none' }),
    day('2026-08-26', { ferments: ['味噌'], natureMinutes: 20 }),
  ]);
  const w = weeklyCondition(days, WEEK, 2);
  const gut = w.perDomain.find((p) => p.domain.id === 'gut')!;
  assert.equal(gut.days, 3);
  assert.equal(gut.possible, 7);
  assert.equal(w.perDomain.find((p) => p.domain.id === 'rules')!.days, 2); // 呼び出し側から渡した数
  assert.equal(w.natureOutdoorDays, 2);
  assert.equal(w.lonelyDays, 1);
  assert.equal(w.fermentKinds.length, 2);
  assert.equal('total' in w, false);
});

test('一番置けていない領域を1つだけ返す。全部できていれば何も言わない', () => {
  const days = map(WEEK.map((d) => day(d, { ferments: ['納豆'], natureMinutes: 15, sleepHygiene: ['bed_only'], social: 'deep', anxietyFelt: false })));
  const full = weeklyCondition(days, WEEK, 7);
  assert.equal(weakestDomain(full), null);

  const partial = weeklyCondition(map([day('2026-08-24', { ferments: ['納豆'] })]), WEEK, 7);
  const weak = weakestDomain(partial);
  assert.ok(weak);
  assert.notEqual(weak!.id, 'gut');
});

test('材料が足りない週は指摘しない', () => {
  assert.equal(weakestDomain(weeklyCondition({}, ['2026-08-24', '2026-08-25'], 0)), null);
});

test('選択肢がそろっている', () => {
  assert.ok(FERMENTS.includes('納豆') && FERMENTS.includes('味噌') && FERMENTS.includes('キムチ'));
  assert.ok(FIBERS.includes('海藻') && FIBERS.includes('ごぼう') && FIBERS.includes('きのこ'));
  assert.equal(SLEEP_HYGIENE.length, 3);
  assert.equal(ANXIETY_ACTIONS.length, 4);
  assert.equal(SOCIAL_OPTIONS.length, 3);
});

test('人間関係の選択肢に個人名を入れる欄が無い（氏名を持たない設計）', () => {
  for (const o of SOCIAL_OPTIONS) {
    assert.equal(/名前|氏名/.test(o.label), false);
  }
  assert.equal('name' in emptyCondition(), false);
});
