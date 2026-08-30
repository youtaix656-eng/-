import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIZETSU_TEXTBOOK_SECTIONS, textbookSectionFor } from '../src/data/keizetsuTextbookMap.js';
import { computeSectionFrequency, FREQ_THRESHOLDS } from '../src/lib/keizetsuTextbookFreq.js';
import keizetsuQuestions from '../src/data/keizetsuQuestions.js';

test('KEIZETSU_TEXTBOOK_SECTIONS: 全項目がpageStart<=pageEnd・タイトル・要約を備える', () => {
  assert.ok(KEIZETSU_TEXTBOOK_SECTIONS.length > 15, 'セクション数が極端に少ない');
  KEIZETSU_TEXTBOOK_SECTIONS.forEach((s) => {
    assert.ok(s.id, 'idが無い');
    assert.ok(Number.isInteger(s.pageStart) && Number.isInteger(s.pageEnd), `${s.id}: ページが整数でない`);
    assert.ok(s.pageStart <= s.pageEnd, `${s.id}: pageStart > pageEnd`);
    assert.ok(s.title && s.title.length > 0, `${s.id}: titleが空`);
    assert.ok(s.summary && s.summary.length > 10, `${s.id}: summaryが短すぎる`);
    assert.ok(Array.isArray(s.genrePrefixes), `${s.id}: genrePrefixesが配列でない`);
  });
});

test('KEIZETSU_TEXTBOOK_SECTIONS: ページ範囲がページ順に並び、大きく逆転しない', () => {
  for (let i = 1; i < KEIZETSU_TEXTBOOK_SECTIONS.length; i++) {
    const prev = KEIZETSU_TEXTBOOK_SECTIONS[i - 1];
    const cur = KEIZETSU_TEXTBOOK_SECTIONS[i];
    assert.ok(cur.pageStart >= prev.pageStart, `${cur.id} が ${prev.id} より前のページになっている`);
  }
});

test('textbookSectionFor: ページ番号から該当セクションを引ける', () => {
  assert.equal(textbookSectionFor(1).id, 'sec-basic-1');
  assert.equal(textbookSectionFor(30).id, 'sec-gv');
  assert.equal(textbookSectionFor(45).id, 'sec-cv');
  assert.equal(textbookSectionFor(140).id, 'sec-bl');
  assert.equal(textbookSectionFor(239).id, 'sec-ref-confusable');
  assert.equal(textbookSectionFor(9999), null);
});

test('十四経すべてに対応するセクションがmeridianId付きで存在する', () => {
  const ids = ['GV', 'CV', 'LU', 'LI', 'ST', 'SP', 'HT', 'SI', 'BL', 'KI', 'PC', 'TE', 'GB', 'LR'];
  ids.forEach((id) => {
    const found = KEIZETSU_TEXTBOOK_SECTIONS.find((s) => s.meridianId === id);
    assert.ok(found, `${id} のセクションが無い`);
  });
});

test('computeSectionFrequency: 実データで各セクションにcount/level/roundsLabelが付く', () => {
  const withStub = [
    { subject: '経絡経穴概論', genre: '正経十二経脈｜足の太陰脾経', round: 30 },
    { subject: '経絡経穴概論', genre: '正経十二経脈｜足の太陰脾経', round: 31 },
    { subject: '経絡経穴概論', genre: '経絡の意義｜正経十二経脈', round: 25 },
    { subject: '他科目', genre: '正経十二経脈｜足の太陰脾経', round: 30 }, // 別科目は数えない
  ];
  const sections = [
    { id: 'a', pageStart: 1, pageEnd: 1, title: 'A', summary: 'summary', genrePrefixes: ['正経十二経脈｜足の太陰脾経'] },
    { id: 'b', pageStart: 2, pageEnd: 2, title: 'B', summary: 'summary', genrePrefixes: ['経絡の意義｜正経十二経脈'] },
    { id: 'c', pageStart: 3, pageEnd: 3, title: 'C', summary: 'summary', genrePrefixes: ['存在しないジャンル'] },
  ];
  const result = computeSectionFrequency(sections, withStub);
  const a = result.find((s) => s.id === 'a');
  assert.equal(a.count, 2);
  assert.deepEqual(a.rounds, [30, 31]);
  assert.equal(a.roundsLabel, '第30回・第31回');
  assert.equal(a.level, 'cool');

  const c = result.find((s) => s.id === 'c');
  assert.equal(c.count, 0);
  assert.equal(c.level, 'none');
  assert.equal(c.roundsLabel, null);
});

test('computeSectionFrequency: しきい値どおりにlevelが変わる', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ subject: '経絡経穴概論', genre: 'X', round: 25 + (i % 10) }));
  const section = { id: 's', pageStart: 1, pageEnd: 1, title: 'S', summary: 'summary', genrePrefixes: ['X'] };
  assert.equal(computeSectionFrequency([section], mk(0))[0].level, 'none');
  assert.equal(computeSectionFrequency([section], mk(FREQ_THRESHOLDS.cool))[0].level, 'cool');
  assert.equal(computeSectionFrequency([section], mk(FREQ_THRESHOLDS.warm))[0].level, 'warm');
  assert.equal(computeSectionFrequency([section], mk(FREQ_THRESHOLDS.hot))[0].level, 'hot');
});

test('実データ（keizetsuQuestions.js）で集計してもエラーにならず、総数が過去問件数以下になる', () => {
  const result = computeSectionFrequency(KEIZETSU_TEXTBOOK_SECTIONS, keizetsuQuestions);
  const totalMatched = result.reduce((sum, s) => sum + s.count, 0);
  const totalKeizetsuWithGenre = keizetsuQuestions.filter((q) => q.subject === '経絡経穴概論' && q.genre).length;
  assert.ok(totalMatched <= totalKeizetsuWithGenre);
  assert.ok(totalMatched > 0, '実データで1件もマッチしない＝genrePrefixesが実際のgenreと噛み合っていない');
  result.forEach((s) => {
    assert.ok(['hot', 'warm', 'cool', 'none'].includes(s.level));
  });
});
