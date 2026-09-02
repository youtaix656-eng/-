import test from 'node:test';
import assert from 'node:assert/strict';
import { FODMAP_FOODS, FODMAP_LEVELS, FODMAP_CATEGORIES, FODMAP_NOTES, FODMAP_SOURCE, FOOD_RESULTS } from '../src/data/fodmap.js';
import { RED_FLAGS, RED_FLAG_CLOSING, RED_FLAG_SOURCE } from '../src/data/redFlags.js';
import { BELLY_STEPS, LEVELS, BRISTOL, BRISTOL_GROUPS, STOOL_MARKS, bristolGroupOf } from '../src/data/scales.js';

test('物差しの形（段は5つ・ブリストルは1〜7）', () => {
  assert.equal(BELLY_STEPS.length, 5);
  assert.deepEqual(BELLY_STEPS.map((s) => s.order), [1, 2, 3, 4, 5]);
  assert.deepEqual(BRISTOL.map((b) => b.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(LEVELS[0].id, 'none');
});

test('ブリストルのまとまりは、1〜7をすき間なく覆う', () => {
  for (let n = 1; n <= 7; n += 1) assert.ok(bristolGroupOf(n), `${n} が どのまとまりにも入らない`);
  assert.equal(bristolGroupOf(0), null);
  assert.equal(bristolGroupOf(8), null);
  const covered = BRISTOL_GROUPS.flatMap((g) => {
    const out = [];
    for (let n = g.range[0]; n <= g.range[1]; n += 1) out.push(n);
    return out;
  });
  assert.equal(new Set(covered).size, 7);
});

test('まとまりの呼び名で「便秘」「下痢」と決めつけない（本人の記録であって診断ではない）', () => {
  for (const group of BRISTOL_GROUPS) {
    assert.doesNotMatch(group.label, /便秘|下痢/);
  }
});

test('お通じの印は、事実だけを書く（意味づけをしない）', () => {
  assert.ok(STOOL_MARKS.length >= 3);
  for (const mark of STOOL_MARKS) {
    assert.doesNotMatch(mark.label, /危険|異常|悪い|やばい/);
  }
  // 受診の目安に載っている項目には印が付いている
  const flagged = STOOL_MARKS.filter((m) => m.flag).map((m) => m.id);
  assert.deepEqual(flagged.sort(), ['black', 'blood']);
});

test('食材の一覧に、欠けや重なりが無い', () => {
  const levels = new Set(FODMAP_LEVELS.map((l) => l.id));
  const categories = new Set(FODMAP_CATEGORIES.map((c) => c.id));
  const names = new Set();
  for (const food of FODMAP_FOODS) {
    assert.ok(levels.has(food.level), `${food.name} の分類が不明`);
    assert.ok(categories.has(food.category), `${food.name} の区分が不明`);
    assert.ok(!names.has(food.name), `${food.name} が二重にある`);
    names.add(food.name);
  }
  assert.ok(FODMAP_FOODS.length >= 80);
});

test('読みは手で書く（自動推定しない）ので、全件がひらがな', () => {
  for (const food of FODMAP_FOODS) {
    assert.match(food.reading, /^[ぁ-んー]+$/, `${food.name} の読み`);
  }
});

test('○×の二択にしない（量で変わるものを「量による」で持つ）', () => {
  assert.deepEqual(FODMAP_LEVELS.map((l) => l.id), ['low', 'depends', 'high']);
  assert.ok(FODMAP_FOODS.some((f) => f.level === 'depends'));
});

test('一覧の注意書きを消さない（量・改訂・長く続けない）', () => {
  const text = FODMAP_NOTES.join('\n');
  assert.match(text, /量によって変わります/);
  assert.match(text, /改訂され続けて/);
  assert.match(text, /相談してください/);
});

test('自分のからだの結果は本人が押す（機械が決めない）', () => {
  assert.deepEqual(FOOD_RESULTS.map((r) => r.id), ['ok', 'ng', 'unknown']);
});

test('受診の目安は、数えない・順位を付けない', () => {
  assert.ok(RED_FLAGS.length >= 5);
  const closing = RED_FLAG_CLOSING.join('');
  assert.match(closing, /当てはまる数は数えません/);
  assert.match(closing, /ひとつも当てはまらなくても/);
  for (const flag of RED_FLAGS) {
    assert.equal(typeof flag.title, 'string');
    assert.doesNotMatch(flag.title, /緊急度|危険度|レベル\d/);
  }
});

test('出典に URL を書かない・最終確認日を持つ', () => {
  for (const source of [FODMAP_SOURCE, RED_FLAG_SOURCE]) {
    assert.doesNotMatch(source.text, /https?:|www\./);
    assert.match(source.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  }
});
