import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HABITS } from '../src/data/habits.js';
import { REPLIES } from '../src/data/replies.js';

test('癖の id・タイトルは重複せず、読みを持つ', () => {
  const ids = HABITS.map((h) => h.id);
  const titles = HABITS.map((h) => h.title);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(titles).size, titles.length);
  for (const h of HABITS) assert.match(h.reading, /^[ぁ-ゖー・]+$/u, `${h.title}: reading が不正`);
});

test('癖は本人を責めない', () => {
  const blame = /(自業自得|甘い|甘え|落ち度|情けない|だからモテ|悪いのはあなた|意志が弱い)/;
  for (const h of HABITS) {
    const text = [h.summary, h.detail, h.step].join(' ');
    assert.doesNotMatch(text, blame, `${h.title}: 責める言い方が入っています`);
  }
});

test('癖に「性格を変えろ」と書かない', () => {
  const change = /(性格を(直|変え)|生まれ変わ|人格を)/;
  for (const h of HABITS) {
    const text = [h.summary, h.detail, h.step].join(' ');
    assert.doesNotMatch(text, change, `${h.title}: 性格を変えろと書いています`);
  }
});

test('その場でできる一手は、相手の同意が要らないことだけ', () => {
  const needsOther = ['分からせ', '納得させ', '約束させ', '言わせる', '変えさせ', '謝らせ', '認めさせ'];
  for (const h of HABITS) {
    assert.ok(h.step, `${h.title}: 一手が空`);
    for (const w of needsOther) {
      assert.ok(!h.step.includes(w), `${h.title}: 一手に「${w}」（相手の同意が要る）が入っています`);
    }
  }
});

test('癖は判定用の語を持たない（貼った文面から自分の癖は分からない）', () => {
  for (const h of HABITS) {
    assert.equal(h.cues, undefined, `${h.title}: cues があります`);
  }
});

test('できること（返し方）に、言い負かす言葉を置かない', () => {
  const fight = /(論破|言い負か|やり込め|黙らせ|勝つ方法|分からせる)/;
  for (const r of REPLIES) {
    const text = [r.summary, r.detail, ...(r.lines || [])].join(' ');
    assert.doesNotMatch(text, fight, `${r.tocTitle}: 言い負かす形が入っています`);
  }
});

test('できることは、相手の同意が要らないものだけ', () => {
  const needsOther = ['相手に認めさせ', '謝らせ', '約束させ', '説得して'];
  for (const r of REPLIES) {
    const text = [r.summary, r.detail].join(' ');
    for (const w of needsOther) {
      assert.ok(!text.includes(w), `${r.tocTitle}: 「${w}」が入っています`);
    }
  }
});

test('相談窓口の案内には「変わることがある」と添える', () => {
  const help = REPLIES.find((r) => r.id === 'ask_help');
  assert.ok(help, '窓口の項目がありません');
  assert.match(help.detail, /変わることがある/, '番号・名称が変わりうることを書く');
});
