import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MYTHS, MYTH_MAP } from '../src/data/myths.js';
import { STATES } from '../src/data/states.js';
import { SOURCE_MAP } from '../src/data/sources.js';

test('よく言われていること／分かっていること／代わりにできること が、すべて分かれている', () => {
  for (const m of MYTHS) {
    assert.ok(m.claim, `${m.title}: よく言われていることが空`);
    assert.ok(m.known, `${m.title}: 分かっていることが空`);
    assert.ok(m.risk, `${m.title}: 信じるとどうなるかが空`);
    assert.ok(m.instead, `${m.title}: 代わりにできることが空`);
    assert.notEqual(m.claim, m.known, `${m.title}: 主張と分かっていることが同じ`);
  }
});

test('元の研究が見つからないものは、そのまま「見つからない」と書く', () => {
  for (const m of MYTHS) {
    if (m.noSource) {
      assert.deepEqual(m.sourceIds, [], `${m.title}: noSource なのに出典が付いています`);
    } else {
      assert.ok(m.sourceIds.length > 0, `${m.title}: 出典も noSource もありません`);
      for (const id of m.sourceIds) assert.ok(SOURCE_MAP[id], `${m.title}: 存在しない出典 ${id}`);
    }
  }
  assert.ok(MYTHS.some((m) => m.noSource), '「見つけられなかった」項目が1件もないのは不自然');
});

test('効き目の割合を書かない', () => {
  const percent = /\d+\s*[%％]/;
  for (const m of MYTHS) {
    const text = [m.claim, m.known, m.risk, m.instead].join(' ');
    assert.doesNotMatch(text, percent, `${m.title}: 割合が書かれています`);
  }
});

test('押せば落ちる、を必ず置く（このアプリでいちばん代償が大きい思い込み）', () => {
  const m = MYTH_MAP.no_means_yes;
  assert.ok(m, '「押せば落ちる」の項目がありません');
  assert.ok(m.sourceIds.includes('kitzinger_frith_1999'));
});

test('自分の中で起きること（states）では診断しない', () => {
  const diagnoses = /(依存症|愛着障害|パーソナリティ障害|うつ病|発達障害|あなたは.{0,6}症)/;
  for (const s of STATES) {
    const text = [s.summary, s.happening, s.care].join(' ');
    assert.doesNotMatch(text, diagnoses, `${s.title}: 病名を当てています`);
  }
});

test('states は当てはめて点数を出す仕掛けを持たない', () => {
  for (const s of STATES) {
    assert.equal(s.score, undefined, `${s.title}: 点数の欄があります`);
    assert.equal(s.checklist, undefined, `${s.title}: チェックリストがあります`);
    assert.ok(s.care, `${s.title}: できることが空`);
  }
});

test('states は本人の弱さの話にしない', () => {
  const blame = /(意志が弱い|甘え|気の持ちよう|自業自得|落ち度|情けない)/;
  for (const s of STATES) {
    const text = [s.summary, s.happening, s.care].join(' ');
    assert.doesNotMatch(text, blame, `${s.title}: 本人を責める言い方が入っています`);
  }
});

test('離れられない状態には、人に相談する道が必ず書いてある', () => {
  const s = STATES.find((x) => x.id === 'cant_leave');
  assert.ok(s, '「離れられない」の項目がありません');
  assert.match(s.care, /(人|窓口|相談)/, 'ここで完結させず、人へ繋ぐこと');
});
