import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MYTHS } from '../src/data/myths.js';
import { STATES, STATES_NOTE } from '../src/data/states.js';
import { SOURCE_MAP } from '../src/data/sources.js';
import { TACTIC_MAP } from '../src/data/tactics.js';

test('見抜き方：id・題は重複せず、読みを持つ', () => {
  const ids = MYTHS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of MYTHS) assert.match(m.reading, /^[ぁ-ゖー・]+$/u, `${m.title}: 読みが不正`);
});

test('見抜き方：「よく言われていること」と「分かっていること」を必ず分けて書く', () => {
  for (const m of MYTHS) {
    assert.ok(m.claim && m.claim.length > 0, `${m.title}: claim が空`);
    assert.ok(m.known && m.known.length > 0, `${m.title}: known が空`);
    assert.ok(m.risk && m.risk.length > 0, `${m.title}: risk が空`);
    assert.ok(m.instead && m.instead.length > 0, `${m.title}: 代わりにできることが空`);
    assert.notEqual(m.claim, m.known, `${m.title}: claim と known が同じ`);
  }
});

test('見抜き方：出典を持つ。持てないものは持てないと印を付ける', () => {
  for (const m of MYTHS) {
    if (m.noSource) {
      assert.deepEqual(m.sourceIds, [], `${m.title}: noSource なのに出典があります`);
      continue;
    }
    assert.ok(m.sourceIds.length > 0, `${m.title}: 出典がありません`);
    for (const id of m.sourceIds) assert.ok(SOURCE_MAP[id], `${m.title}: 存在しない出典 ${id}`);
  }
});

test('見抜き方：効き目や当たる割合を数字で断定しない', () => {
  for (const m of MYTHS) {
    const body = [m.claim, m.known, m.risk, m.instead].join(' ');
    assert.doesNotMatch(body, /\d+\s*[%％]/, `${m.title}: 割合を数字で書いています`);
    assert.doesNotMatch(body, /必ず見抜ける|確実に分かる|百発百中/, `${m.title}: 断定しています`);
  }
});

test('見抜き方：型（相手のすること）と id がぶつからない', () => {
  for (const m of MYTHS) assert.ok(!TACTIC_MAP[m.id], `${m.id}: 型と同じ id です`);
});

test('状態：診断しない（病名を当てない・断定しない）', () => {
  const diagnosing = /あなたは.{0,6}(症|障害|病)|診断|の疑いがあります|に該当します/;
  for (const st of STATES) {
    const body = [st.summary, st.detail].join(' ');
    const m = body.match(diagnosing);
    assert.ok(!m, `${st.title}: 診断のような書き方「${m && m[0]}」が入っています`);
  }
  assert.match(STATES_NOTE, /診断/, '「診断ではない」と断っていません');
  assert.match(STATES_NOTE, /相談/, '相談へ繋いでいません');
});

test('状態：本人の弱さの話にしない', () => {
  const blame = /心が弱い|気の持ちよう|甘え|根性|気にしすぎ(?!と言われ)/;
  for (const st of STATES) {
    const body = [st.summary, st.detail].join(' ');
    const m = body.match(blame);
    assert.ok(!m, `${st.title}: 本人を責める言い方「${m && m[0]}」が入っています`);
  }
});

test('状態：当てはめて判定する仕掛けを持たない（チェックリストにしない）', () => {
  for (const st of STATES) {
    for (const forbidden of ['cues', 'score', 'threshold', 'checklist', 'questions']) {
      assert.ok(!(forbidden in st), `${st.title}: ${forbidden} を持っています`);
    }
  }
});

test('状態：出典を持ち、読みがある', () => {
  for (const st of STATES) {
    assert.match(st.reading, /^[ぁ-ゖー・]+$/u, `${st.title}: 読みが不正`);
    assert.ok(st.sourceIds.length > 0, `${st.title}: 出典がありません`);
    for (const id of st.sourceIds) assert.ok(SOURCE_MAP[id], `${st.title}: 存在しない出典 ${id}`);
  }
});

test('見抜き方・状態の文にマークダウンを書かない', () => {
  const texts = [
    ...MYTHS.flatMap((m) => [m.title, m.claim, m.known, m.risk, m.instead]),
    ...STATES.flatMap((s) => [s.title, s.summary, s.detail]),
    STATES_NOTE,
  ];
  for (const t of texts) assert.ok(!String(t).includes('**'), `「${t}」に ** が入っています`);
});
