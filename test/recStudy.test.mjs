import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as rs from '../src/lib/recStudy.js';

const D = rs.DAY_MS;
test('箱方式：○で次の段（翌日→3日後…）、△は同じ間隔、✕は翌日へ戻す、6回で卒業', () => {
  let b = {};
  b = rs.gradeBox(b, 'q', 'maru', 0); // 当日→翌日
  assert.equal(b.q.stage, 1); assert.equal(b.q.due, D);
  b = rs.gradeBox(b, 'q', 'maru', D); // 翌日→3日後
  assert.equal(b.q.stage, 2); assert.equal(b.q.due, 3 * D);
  b = rs.gradeBox(b, 'q', 'sankaku', 3 * D); // 同じ段・同じ2日
  assert.equal(b.q.stage, 2); assert.equal(b.q.due, 5 * D);
  b = rs.gradeBox(b, 'q', 'batsu', 5 * D);
  assert.equal(b.q.stage, 1); assert.equal(b.q.due, 6 * D);
  let c = {};
  for (let i = 0; i < 6; i += 1) c = rs.gradeBox(c, 'x', 'maru', i);
  assert.equal(c.x.stage, rs.BOX_DONE); assert.equal(c.x.due, null);
  assert.deepEqual(rs.boxDueIds({ ...b, x: c.x }, 6 * D), ['q']);
  assert.deepEqual(rs.boxDueIds(b, 5 * D), []);
});

test('苦手トラック：△✕で入り、3回続けて○で外れる', () => {
  let w = rs.gradeWeak({}, 'q', 'batsu');
  w = rs.gradeWeak(w, 'q', 'maru'); w = rs.gradeWeak(w, 'q', 'maru');
  assert.ok(w.q);
  w = rs.gradeWeak(w, 'q', 'maru');
  assert.equal(w.q, undefined);
  assert.deepEqual(rs.gradeWeak({}, 'z', 'maru'), {}); // 入っていない問題は○で入らない
});

test('耳用の四択は四択の5問に1問だけ・2周目は進捗を除いて問題だけ', () => {
  const four = (q) => q.type !== 'ox';
  const items = Array.from({ length: 10 }, (_, i) => ({ kind: 'question', q: { id: `q${i}`, type: i === 1 ? 'ox' : 'choice' } }));
  const flagged = rs.flagEarChoices(items, four).filter((it) => it.earChoices).length;
  assert.equal(flagged, 2);
  const tp = rs.twoPass([...items.slice(0, 2), { kind: 'progress' }]);
  assert.equal(tp.length, 3 + 1 + 2);
  assert.equal(tp[3].kind, 'passNote');
  assert.ok(tp.slice(4).every((it) => it.pass === 2));
});

test('同じ論点を穴埋めで：3問あとに入り、最後のものは末尾へ', () => {
  const items = Array.from({ length: 5 }, (_, i) => ({ kind: 'question', q: { id: `q${i}` } }));
  const out = rs.mixFormats(items, (q) => q.id === 'q0' || q.id === 'q4');
  assert.equal(out.length, 7);
  assert.equal(out[4].kind, 'cloze'); assert.equal(out[4].q.id, 'q0');
  assert.equal(out[6].q.id, 'q4');
});

test('自信の度合い：たぶん・勘は当たっても○にしない', () => {
  assert.equal(rs.kindForPick(true, 'sure'), 'maru');
  assert.equal(rs.kindForPick(true, 'maybe'), 'sankaku');
  assert.equal(rs.kindForPick(true, 'guess'), 'batsu');
  assert.equal(rs.kindForPick(false, 'sure'), 'batsu');
});

test('今日の記録は日付が変わると作り直す・名前は日付_テーマ_回数', () => {
  const d = rs.ensureDay({ date: '2026-11-26', newIds: ['a'], newListens: 2 }, '2026-11-27');
  assert.deepEqual(d, { date: '2026-11-27', newIds: [], newListens: 0, reviewOnly: false });
  assert.equal(rs.trackName('2026-11-27', '新しい問題', 2), '2026-11-27_新しい問題_2回目');
  assert.equal(rs.slotForHour(5).slot, 'weak');
  assert.equal(rs.slotForHour(22).slot, 'new');
});
