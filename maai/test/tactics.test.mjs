import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TACTICS,
  CATEGORIES,
  CATEGORY_MAP,
  tacticsInCategory,
  textTactics,
  behaviorTactics,
} from '../src/data/tactics.js';
import { SOURCE_MAP } from '../src/data/sources.js';
import { REPLY_MAP } from '../src/data/replies.js';
import { detectTactics } from '../src/lib/detect.js';

test('型の id・名前は重複しない', () => {
  const ids = TACTICS.map((t) => t.id);
  const names = TACTICS.map((t) => t.name);
  assert.equal(new Set(ids).size, ids.length, 'id の重複');
  assert.equal(new Set(names).size, names.length, '名前の重複');
});

test('すべての型が実在するまとまりに属する（まとまりは空にならない）', () => {
  for (const t of TACTICS) assert.ok(CATEGORY_MAP[t.category], `${t.name}: 未知のまとまり`);
  for (const c of CATEGORIES) assert.ok(tacticsInCategory(c.id).length > 0, `${c.label}: 0件`);
});

test('すべての型が出典・できること・見分け方を持つ', () => {
  for (const t of TACTICS) {
    assert.ok(t.summary && t.why, `${t.name}: summary/why が空`);
    assert.ok(t.signs && t.signs.length >= 2, `${t.name}: 見分け方が2つ未満`);
    assert.ok(t.sourceIds && t.sourceIds.length > 0, `${t.name}: 出典がありません`);
    for (const id of t.sourceIds) assert.ok(SOURCE_MAP[id], `${t.name}: 存在しない出典 ${id}`);
    assert.ok(t.replyIds && t.replyIds.length > 0, `${t.name}: できることがありません`);
    for (const id of t.replyIds) assert.ok(REPLY_MAP[id], `${t.name}: 存在しないできること ${id}`);
  }
});

test('型に「やり方」を持たせない（できること・手順の欄を作らない）', () => {
  // 見分け方と、なぜ効くかだけ。手順の欄を足した時点で、これは使い方の説明になる。
  for (const t of TACTICS) {
    assert.equal(t.how, undefined, `${t.name}: 型に手順（how）が付いています`);
    assert.equal(t.steps, undefined, `${t.name}: 型に手順（steps）が付いています`);
  }
});

test('型は「言葉の型」か「言葉に残らない型」のどちらかに分かれている', () => {
  for (const t of TACTICS) {
    assert.ok(['text', 'behavior'].includes(t.channel), `${t.name}: channel が ${t.channel}`);
  }
  assert.equal(textTactics().length + behaviorTactics().length, TACTICS.length);
  assert.ok(behaviorTactics().length > 0, '言葉に残らない型が1件もありません');
});

test('言葉の型は、言われる形の例と判定用の語を持つ', () => {
  for (const t of textTactics()) {
    assert.ok(t.lines && t.lines.length >= 1, `${t.name}: 言われる形の例がありません`);
    assert.ok(t.cues && t.cues.length >= 3, `${t.name}: 判定用の語が3つ未満`);
  }
});

test('言葉に残らない型は判定用の語を持たない', () => {
  for (const t of behaviorTactics()) {
    assert.deepEqual(t.cues, [], `${t.name}: cues があります`);
    assert.deepEqual(t.lines, [], `${t.name}: 言われる形があります`);
  }
});

test('言葉に残らない型は、何を貼っても判定に出てこない', () => {
  const ids = new Set(behaviorTactics().map((t) => t.id));
  const texts = [
    behaviorTactics().map((t) => `${t.name} ${t.summary} ${t.why}`).join(' '),
    '奥の席に座らされて、黙ったまま距離を詰められ、断ったら急に無言になりました。',
  ];
  for (const text of texts) {
    // カタログ全部を渡しても（＝呼び出し側が絞り忘れても）出てこないこと
    const r = detectTactics(text, TACTICS);
    for (const m of r.matches) {
      assert.ok(!ids.has(m.tactic.id), `${m.tactic.name}: 言葉に残らない型が判定に出ています`);
    }
  }
});

test('判定用の語に、どこにでも出る言葉を入れない', () => {
  const tooCommon = ['好き', 'ありがとう', 'うん', '会いたい', 'かわいい', 'ごめん', 'おはよう', 'いいよ'];
  for (const t of textTactics()) {
    for (const cue of t.cues) {
      assert.ok(
        !tooCommon.includes(cue),
        `${t.name}: 「${cue}」はどこにでも出る言葉なので判定に使わない`,
      );
      assert.ok(cue.length >= 2, `${t.name}: 「${cue}」は短すぎる`);
    }
  }
});

test('効き目の大きさ・点数・順位を書かない', () => {
  const percent = /\d+\s*[%％]/;
  // 「順位を決める権利は相手にある」のような普通の文は止めない。
  // 止めるのは、このアプリが点数や順位を**出している**形だけ。
  const scoring = /(危険度|ランキング|\d+\s*点|レベル\s*\d)/;
  for (const t of TACTICS) {
    const text = [t.summary, t.why, ...t.signs].join(' ');
    assert.doesNotMatch(text, percent, `${t.name}: 効き目の割合が書かれています`);
    assert.doesNotMatch(text, scoring, `${t.name}: 点数・順位が書かれています`);
    assert.equal(t.score, undefined, `${t.name}: 点数の欄があります`);
    assert.equal(t.danger, undefined, `${t.name}: 危険度の欄があります`);
  }
});

test('判定は点数を返さない（当たった語の数を点数として持たない）', () => {
  const r = detectTactics('今日しかないから、もう一軒だけ行こう。終電もう無いよ。', TACTICS);
  assert.equal(r.status, 'ok');
  for (const m of r.matches) {
    assert.equal(m.score, undefined);
    assert.ok(Array.isArray(m.cues) && m.cues.length > 0, '当たった語を必ず見せる');
  }
});

test('別名（世に出回っている呼び名）には読みがある', () => {
  for (const t of TACTICS) {
    for (const a of t.aka || []) {
      assert.match(a.reading, /^[ぁ-ゖー・]+$/u, `${t.name}: 別名「${a.name}」の読みが不正`);
    }
  }
});

test('依存させる・断りを押し返す・段取りで決めさせる、が必ず入っている', () => {
  // 「依存させたい」「口説き落としたい」「お持ち帰りしたい」で調べに来た人が、
  // その形を見つけられること。ここが抜けると、このアプリの半分が意味を失う。
  for (const id of ['hot_cold', 'love_bomb', 'no_as_yes', 'last_train', 'drink_more', 'gaslight']) {
    assert.ok(TACTICS.some((t) => t.id === id), `${id} が見つかりません`);
  }
});
