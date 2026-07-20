import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allSubjects,
  allRounds,
  allTags,
  effectiveTags,
  filterQuestions,
  searchQuestions,
  buildOrder,
} from '../src/lib/query.js';

const qs = [
  { id: 'a', subject: '解剖学', round: '第32回', tags: ['神経'], question: '橈骨神経が支配する筋はどれか。', choices: ['上腕三頭筋', 'x'], answer: 0 },
  { id: 'b', subject: '生理学', round: '第34回', question: 'インスリンを分泌するのは。', choices: ['B細胞', 'x'], answer: 0 },
  { id: 'c', subject: '解剖学', round: '第34回', tags: ['骨'], question: '脊髄が終わる高さは。', choices: ['L1-2', 'x'], answer: 0 },
];
const links = { b: { keywords: ['ホルモン'] } };

test('科目・回次・タグの一覧', () => {
  assert.deepEqual([...allSubjects(qs)].sort(), ['生理学', '解剖学'].sort());
  assert.deepEqual(allRounds(qs), ['第32回', '第34回']);
  const tags = allTags(qs, links);
  assert.ok(tags.includes('神経') && tags.includes('骨') && tags.includes('ホルモン'));
});

test('effectiveTags は問題tagsと連結キーワードを合わせる', () => {
  assert.deepEqual(effectiveTags(qs[1], links), ['ホルモン']);
});

test('科目で絞り込み', () => {
  const r = filterQuestions(qs, { subjects: ['解剖学'] });
  assert.equal(r.length, 2);
});

test('回次で絞り込み', () => {
  const r = filterQuestions(qs, { rounds: ['第34回'] });
  assert.equal(r.length, 2);
});

test('タグで絞り込み（連結キーワード含む）', () => {
  const r = filterQuestions(qs, { tags: ['ホルモン'], links });
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'b');
});

test('科目＋回次の複合絞り込み', () => {
  const r = filterQuestions(qs, { subjects: ['解剖学'], rounds: ['第34回'] });
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'c');
});

test('onlyTagged はタグ無しを除外', () => {
  const r = filterQuestions(qs, { onlyTagged: true, links });
  const ids = r.map((q) => q.id).sort();
  assert.deepEqual(ids, ['a', 'b', 'c']); // a,c は tags、b は links キーワード
});

test('検索は問題文・科目・タグを横断', () => {
  assert.equal(searchQuestions(qs, '橈骨', links).length, 1);
  assert.equal(searchQuestions(qs, '解剖', links).length, 2);
  assert.equal(searchQuestions(qs, 'ホルモン', links).length, 1); // 連結キーワード
  assert.equal(searchQuestions(qs, '存在しない語', links).length, 0);
  assert.equal(searchQuestions(qs, '', links).length, 0);
});

test('buildOrder は件数を制限する', () => {
  const order = buildOrder(qs, { count: 2, random: false });
  assert.equal(order.length, 2);
  const all = buildOrder(qs, { count: 0, random: false });
  assert.equal(all.length, 3);
});
