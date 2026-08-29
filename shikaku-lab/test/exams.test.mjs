import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAMS,
  EXAM_CATEGORIES,
  TRAIT_IDS,
  FORMAT_IDS,
  TRAIT_VOCABULARY,
  FORMAT_VOCABULARY,
  examById,
  checkPointsOf,
  COMMON_CHECK_POINTS,
} from '../src/data/exams.js';

test('id が重複していない', () => {
  const ids = EXAMS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('試験名が重複していない（目次でぶつかる）', () => {
  const names = EXAMS.map((e) => e.name);
  assert.equal(new Set(names).size, names.length);
});

test('すべての試験に読み（ひらがな）がある', () => {
  for (const e of EXAMS) {
    assert.ok(e.reading, `${e.name} に reading がありません`);
    assert.match(e.reading, /^[ぁ-ん・ー]+$/, `${e.name} の reading にひらがな以外が入っています：${e.reading}`);
  }
});

test('すべての科目に読みがある', () => {
  for (const e of EXAMS) {
    assert.ok((e.subjects || []).length > 0, `${e.name} に科目がありません`);
    for (const s of e.subjects) {
      assert.ok(s.reading, `${e.name} の科目「${s.name}」に reading がありません`);
      assert.match(s.reading, /^[ぁ-ん・ー]+$/, `${e.name}／${s.name} の reading：${s.reading}`);
    }
  }
});

test('traits / formats / category が語彙の中にある', () => {
  const cats = new Set(EXAM_CATEGORIES.map((c) => c.id));
  for (const e of EXAMS) {
    assert.ok(cats.has(e.category), `${e.name} の category が未定義：${e.category}`);
    assert.ok((e.formats || []).length > 0, `${e.name} に formats がありません`);
    for (const f of e.formats) assert.ok(FORMAT_IDS.includes(f), `${e.name} の format：${f}`);
    for (const t of e.traits || []) assert.ok(TRAIT_IDS.includes(t), `${e.name} の trait：${t}`);
  }
});

// このアプリの一番大事な約束（exams.js の頭のコメント）を機械で見張る。
// 毎年変わる数字を持つと、古い数字を信じてしまう事故が起きる。
test('毎年変わる数字を持っていない（合格率・合格点・試験日・受験料）', () => {
  const json = JSON.stringify(EXAMS);
  const banned = [
    /合格率[^」]{0,4}[0-9０-９]/, // 「合格率は約30%」のような形
    /合格点[^」]{0,4}[0-9０-９]/,
    /受験料[^」]{0,4}[0-9０-９]/,
    /[0-9０-９]{1,3}(\.[0-9])?\s*[%％]/, // 生のパーセント
    /20[0-9]{2}年[0-9]{1,2}月[0-9]{1,2}日/, // 具体的な日付
  ];
  for (const re of banned) {
    const hit = re.exec(json);
    assert.equal(hit, null, `毎年変わる数字が書かれています：${hit && hit[0]}`);
  }
});

test('確かめることの一覧は、共通＋個別が全部出る', () => {
  const takken = examById('takken');
  const points = checkPointsOf(takken);
  for (const c of COMMON_CHECK_POINTS) assert.ok(points.includes(c));
  for (const c of takken.checkPoints) assert.ok(points.includes(c));
  // 試験が未選択でも落ちない（共通だけ返る）
  assert.deepEqual(checkPointsOf(null), [...COMMON_CHECK_POINTS]);
});

test('語彙にはラベルと一言がそろっている', () => {
  for (const [id, v] of Object.entries(TRAIT_VOCABULARY)) {
    assert.ok(v.label && v.hint, `trait ${id}`);
  }
  for (const [id, v] of Object.entries(FORMAT_VOCABULARY)) {
    assert.ok(v.label && v.hint, `format ${id}`);
  }
});
