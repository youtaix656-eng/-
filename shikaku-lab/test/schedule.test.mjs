import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as S from '../src/lib/schedule.js';

const FROM = new Date(2026, 7, 29); // 2026-08-29（土）

test('日付は端末の時刻帯で読む（UTCとして読んで前日にしない）', () => {
  const d = S.parseDate('2026-08-29');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 29);
  assert.equal(S.formatDate(d), '2026-08-29');
});

test('読めない日付では null を返す（勝手に今日を入れない）', () => {
  assert.equal(S.parseDate('ふつか'), null);
  assert.equal(S.parseDate(''), null);
  assert.equal(S.buildSchedule({ examDate: 'あした' }), null);
  assert.equal(S.buildSchedule({}), null);
});

test('残り日数は当日を1日と数える', () => {
  assert.equal(S.daysUntil('2026-08-29', FROM), 1);
  assert.equal(S.daysUntil('2026-08-30', FROM), 2);
  assert.equal(S.daysUntil('2026-08-01', FROM), 0, '過去の日付は0');
});

test('平日と休日の内訳が合計と合う', () => {
  const split = S.splitDays('2026-09-30', FROM);
  assert.equal(split.weekday + split.weekend, split.total);
});

test('フェーズの日数の合計が、残り日数とぴったり合う', () => {
  const sc = S.buildSchedule({ examDate: '2027-02-21', weekdayMin: 60, weekendMin: 180, from: FROM });
  assert.equal(sc.phases.reduce((n, p) => n + p.days, 0), sc.days);
  assert.equal(sc.phases.reduce((n, p) => n + p.minutes, 0), sc.totalMinutes);
});

test('最後のフェーズが試験日で終わる', () => {
  const sc = S.buildSchedule({ examDate: '2027-02-21', weekdayMin: 60, weekendMin: 180, from: FROM });
  assert.equal(sc.phases[0].startDate, '2026-08-29');
  assert.equal(sc.phases[sc.phases.length - 1].endDate, '2027-02-21');
  // フェーズの間に切れ目・重なりが無い
  for (let i = 1; i < sc.phases.length; i += 1) {
    const prevEnd = S.parseDate(sc.phases[i - 1].endDate);
    const start = S.parseDate(sc.phases[i].startDate);
    assert.equal((start - prevEnd) / (24 * 60 * 60 * 1000), 1, `${i}番目のフェーズがつながっていません`);
  }
});

test('比率を変えると配分が変わる（比率をハードコーディングしていない）', () => {
  const a = S.buildSchedule({ examDate: '2027-02-21', weekdayMin: 60, weekendMin: 60, from: FROM });
  const b = S.buildSchedule({
    examDate: '2027-02-21',
    weekdayMin: 60,
    weekendMin: 60,
    ratio: { input: 10, drill: 10, finish: 80 },
    from: FROM,
  });
  assert.ok(b.phases[2].days > a.phases[2].days);
  assert.equal(b.phases.reduce((n, p) => n + p.days, 0), b.days);
});

test('確保時間は入れた分数どおり', () => {
  const sc = S.buildSchedule({ examDate: '2026-09-05', weekdayMin: 30, weekendMin: 120, from: FROM });
  assert.equal(sc.totalMinutes, sc.weekdayDays * 30 + sc.weekendDays * 120);
});

test('科目の割り振りは重みどおりで、合計が確保時間に収まる', () => {
  const sc = S.buildSchedule({ examDate: '2027-02-21', weekdayMin: 60, weekendMin: 120, from: FROM });
  const subjects = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  const even = S.allocateSubjects(sc, subjects);
  assert.equal(new Set(even.map((s) => s.minutes)).size <= 2, true, '均等のはずが大きくずれています');
  const weighted = S.allocateSubjects(sc, subjects, { A: 3, B: 1, C: 1 });
  assert.ok(weighted[0].minutes > weighted[1].minutes * 2);
  const sum = weighted.reduce((n, s) => n + s.minutes, 0);
  assert.ok(Math.abs(sum - sc.totalMinutes) <= subjects.length, '合計が確保時間から離れています');
});

test('重みが全部0でも落ちない（0で割らない）', () => {
  const sc = S.buildSchedule({ examDate: '2027-02-21', weekdayMin: 60, weekendMin: 60, from: FROM });
  const out = S.allocateSubjects(sc, [{ name: 'A' }], { A: 0 });
  assert.equal(out[0].minutes, 0);
});

test('期間が短いときは「削る候補」を出す（間に合わないとだけ言わない）', () => {
  const sc = S.buildSchedule({ examDate: '2026-09-10', weekdayMin: 0, weekendMin: 60, from: FROM });
  const opts = S.tightOptions(sc, 10);
  assert.ok(opts.length > 0);
  for (const o of opts) assert.ok(o.title && o.detail);
  assert.equal(opts.some((o) => /間に合いません/.test(o.title + o.detail)), false);
});

// 「合格に必要な時間」を持たない＝手元に無い基準を書かない、の見張り。
test('必要な時間の目安を持たない', () => {
  const src = readFileSync(new URL('../src/lib/schedule.js', import.meta.url), 'utf8');
  assert.equal(/必要な時間\s*[=＝:：]/.test(src), false);
  assert.equal(/合格まで[0-9０-９]/.test(src), false);
  assert.equal(/平均[0-9０-９]{2,}時間/.test(src), false);
});
