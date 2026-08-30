import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROACHES,
  PHASES,
  PHASE_MAP,
  EVIDENCE,
  approachesInPhase,
  approachesByEvidence,
} from '../src/data/approach.js';
import { SOURCE_MAP } from '../src/data/sources.js';

test('近づき方の id・名前は重複しない', () => {
  const ids = APPROACHES.map((a) => a.id);
  const names = APPROACHES.map((a) => a.name);
  assert.equal(new Set(ids).size, ids.length, 'id の重複');
  assert.equal(new Set(names).size, names.length, '名前の重複');
});

test('すべての項目が実在する段に属し、段は空にならない', () => {
  for (const a of APPROACHES) assert.ok(PHASE_MAP[a.phase], `${a.name}: 未知の段 ${a.phase}`);
  for (const p of PHASES) assert.ok(approachesInPhase(p.id).length > 0, `${p.label}: 0件`);
});

test('すべての項目が 出典・確からしさ・自分の側でできること を持つ', () => {
  for (const a of APPROACHES) {
    assert.ok(a.summary && a.why, `${a.name}: summary/why が空`);
    assert.ok(a.how && a.how.length >= 1, `${a.name}: できることが空`);
    assert.ok(a.mistakes && a.mistakes.length >= 1, `${a.name}: 取り違えが空`);
    assert.ok(EVIDENCE[a.evidence], `${a.name}: 未知の確からしさ ${a.evidence}`);
    assert.ok(a.evidenceNote, `${a.name}: 確からしさの説明が空`);
    assert.ok(a.sourceIds && a.sourceIds.length > 0, `${a.name}: 出典がありません`);
    for (const id of a.sourceIds) assert.ok(SOURCE_MAP[id], `${a.name}: 存在しない出典 ${id}`);
  }
});

test('確からしさの3段はすべて実際に使われている（thin を隠さない）', () => {
  for (const level of Object.keys(EVIDENCE)) {
    assert.ok(approachesByEvidence(level).length > 0, `${level} の項目が1件もありません`);
  }
});

test('研究ではないものを「研究によると」と書かない', () => {
  // thin（言われているだけ・こちらが置いた決めごと）は、**研究ではない出典を必ず1つ持つ**。
  // 研究から導いただけの線に、研究の出典しか付いていないと、
  // 画面では「研究で確かめられたこと」に見えてしまう。
  for (const a of approachesByEvidence('thin')) {
    const hasNonResearch = a.sourceIds.some((id) => SOURCE_MAP[id].research === false);
    assert.ok(
      hasNonResearch,
      `${a.name}: 研究ではない項目なのに、研究の出典しか付いていません`,
    );
  }
});

// ここがこのアプリでいちばん壊しやすい線。
test('相手の同意が要ることを「できること」に書かない', () => {
  const banned = [
    '酔わせ',
    '飲ませ',
    '押し切',
    '押し倒',
    '密室',
    '連れ込',
    '既成事実',
    '帰さない',
    '帰らせない',
    '断らせない',
    '断れなく',
    '逃げ場',
    '言いくるめ',
    'その気にさせ',
    '落とす',
    '落とし方',
  ];
  for (const a of APPROACHES) {
    for (const line of a.how) {
      for (const word of banned) {
        assert.ok(
          !line.includes(word),
          `${a.name}: できることに「${word}」が入っています（自分の側だけで完結することしか書かない）`,
        );
      }
    }
  }
});

test('効き目の大きさを書かない（数字も、必ず・誰でもの言い切りも）', () => {
  const percent = /\d+\s*[%％]/;
  const promises = [/必ず(落ち|好きに|うまく)/, /絶対に(落ち|うまく)/, /誰でも(落と|モテ)/, /確実に(落と|好かれ)/];
  for (const a of APPROACHES) {
    const text = [a.summary, a.why, a.evidenceNote, ...a.how, ...a.mistakes].join(' ');
    assert.doesNotMatch(text, percent, `${a.name}: 効き目の割合が書かれています`);
    for (const p of promises) assert.doesNotMatch(text, p, `${a.name}: 効き目を言い切っています`);
  }
});

test('性別で決めつけない', () => {
  const bad = /(男|女)(は|って|性は)[^、。]{0,10}(だから|なので|という生き物)/;
  for (const a of APPROACHES) {
    const text = [a.summary, a.why, ...a.how, ...a.mistakes].join(' ');
    assert.doesNotMatch(text, bad, `${a.name}: 性別で決めつけています`);
  }
});

test('漢字を含む名前には読みがある（ひらがなだけ）', () => {
  for (const a of APPROACHES) {
    assert.match(a.reading, /^[ぁ-ゖー・]+$/u, `${a.name}: reading が不正`);
  }
  for (const p of PHASES) {
    assert.match(p.reading, /^[ぁ-ゖー・]+$/u, `${p.label}: reading が不正`);
  }
});

test('断りの読み替えを止める項目が、必ず入っている', () => {
  // この1件が抜けると、近づき方はそのまま「断りを押し返す型」になる。
  const soft = APPROACHES.find((a) => a.id === 'soft_no');
  assert.ok(soft, 'あいまいな返事を読み替えない、が見つかりません');
  assert.equal(soft.evidence, 'clear');
  assert.ok(soft.sourceIds.includes('kitzinger_frith_1999'));
});
