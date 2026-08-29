import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HABITS, HABIT_MAP } from '../src/data/habits.js';
import { TACTIC_MAP } from '../src/data/tactics.js';
import { REPLY_MAP } from '../src/data/replies.js';

test('id・題は重複せず、読みを持つ', () => {
  const ids = HABITS.map((h) => h.id);
  const titles = HABITS.map((h) => h.title);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(titles).size, titles.length);
  for (const h of HABITS) {
    assert.match(h.reading, /^[ぁ-ゖー・]+$/u, `${h.title}: 読みがひらがなではありません`);
  }
});

test('中身がそろっている（何が起きているか・こうなっていたら・その場の一手）', () => {
  for (const h of HABITS) {
    assert.ok(h.summary && h.why, `${h.title}: summary か why が空`);
    assert.ok(h.signs.length >= 2, `${h.title}: 見分けが2つ未満`);
    assert.ok(h.moves.length >= 2, `${h.title}: その場でできる一手が2つ未満`);
  }
});

test('繋ぎ先（返し方・型）はすべて実在する', () => {
  for (const h of HABITS) {
    assert.ok(h.replyIds.length > 0, `${h.title}: 返し方がありません`);
    for (const id of h.replyIds) assert.ok(REPLY_MAP[id], `${h.title}: 存在しない返し方 ${id}`);
    for (const id of h.relatedTacticIds) assert.ok(TACTIC_MAP[id], `${h.title}: 存在しない型 ${id}`);
  }
});

test('本人を責める言い方を置かない（つけこむ側がいるから起きること）', () => {
  const blame = /自業自得|甘え|甘い|弱いから|落ち度|あなたが悪い|自己責任|情けない|だらしな|直すべき|治すべき/;
  for (const h of HABITS) {
    const body = [h.summary, h.why, ...h.signs, ...h.moves].join(' ');
    const m = body.match(blame);
    assert.ok(!m, `${h.title}: 責める言い方「${m && m[0]}」が入っています`);
  }
});

test('性格を変えろと言わない（変えられるのはその場の一手だけ）', () => {
  const personality = /性格を変え|生まれ変わ|強くなれ|もっと自信を持て|考え方を改め/;
  for (const h of HABITS) {
    const body = [h.summary, h.why, ...h.signs, ...h.moves].join(' ');
    assert.doesNotMatch(body, personality, `${h.title}: 性格を変えろと書いています`);
  }
});

test('その場の一手は、相手の同意が要らないことにする', () => {
  // 「相手に分からせる」「納得させる」は自分だけでは完結しない
  const needsOther = /分からせ|納得させ|反省させ|謝らせ|改めさせ|やめさせる/;
  for (const h of HABITS) {
    for (const m of h.moves) {
      assert.doesNotMatch(m, needsOther, `${h.title}: 「${m}」は相手の同意が要ります`);
    }
  }
});

test('型（相手のすること）と癖（自分のしていること）を混ぜない', () => {
  for (const h of HABITS) {
    assert.ok(!TACTIC_MAP[h.id], `${h.id}: 型と同じ id を使っています`);
    assert.ok(!HABIT_MAP[h.id]?.cues, `${h.title}: 癖に判定用の語を持たせています`);
  }
});
