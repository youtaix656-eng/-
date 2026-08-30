import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riskOf, matchesSearch, filterReview, sortReview } from '../src/lib/reviewOrder.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

test('riskOf: 間隔未確定は最優先(1)、期限超過は高リスク', () => {
  assert.equal(riskOf({ id: 'a' }, { a: { seen: 1, interval: 0 } }, NOW), 1);
  const overdue = riskOf({ id: 'b' }, { b: { seen: 2, interval: 10, due: NOW - 20 * DAY } }, NOW);
  const fresh = riskOf({ id: 'c' }, { c: { seen: 2, interval: 10, due: NOW + 9 * DAY } }, NOW);
  assert.ok(overdue > fresh);
});

test('matchesSearch: 語・科目・タグ・同義語で一致', () => {
  const q = { question: '合谷について', subject: '経絡経穴概論', tags: ['合谷'], choices: [], explanation: '' };
  assert.equal(matchesSearch(q, '合谷', {}), true);
  assert.equal(matchesSearch(q, '経絡', {}), true);
  assert.equal(matchesSearch(q, '存在しない語', {}), false);
  // 同義語（ACL→前十字靱帯）
  const q2 = { question: '前十字靱帯損傷の検査', subject: '臨床', tags: ['前十字靱帯'], choices: [], explanation: '' };
  assert.equal(matchesSearch(q2, 'ACL', {}), true);
});

test('filterReview: 科目・タグ・検索で絞り込み', () => {
  const qs = [
    { id: 'a', subject: '循環器', tags: ['心不全'], question: '心不全' },
    { id: 'b', subject: '運動器', tags: ['骨折'], question: '骨折' },
  ];
  assert.deepEqual(filterReview(qs, { tag: '心不全', links: {} }).map((q) => q.id), ['a']);
  assert.deepEqual(filterReview(qs, { term: '骨折', links: {} }).map((q) => q.id), ['b']);
  assert.deepEqual(filterReview(qs, { subject: '運動器', links: {} }).map((q) => q.id), ['b']);
  assert.deepEqual(filterReview(qs, { subject: '循環器', term: '骨折', links: {} }).map((q) => q.id), []);
});

test('filterReview: 誤答理由の型で絞り込み', () => {
  const qs = [
    { id: 'a', subject: '循環器', tags: [], question: 'a' },
    { id: 'b', subject: '運動器', tags: [], question: 'b' },
    { id: 'c', subject: '運動器', tags: [], question: 'c' },
  ];
  const missTypes = { a: { type: 'careless', at: 1 }, b: { type: 'chishiki', at: 2 } };
  assert.deepEqual(
    filterReview(qs, { missType: 'careless', missTypes, links: {} }).map((q) => q.id),
    ['a']
  );
  assert.deepEqual(
    filterReview(qs, { missType: 'chishiki', missTypes, links: {} }).map((q) => q.id),
    ['b']
  );
  // 型未記録は対象外（cは記録なしなので除外される）
  assert.deepEqual(
    filterReview(qs, { missType: 'kanchigai', missTypes, links: {} }).map((q) => q.id),
    []
  );
  // 指定なしなら全件通す
  assert.deepEqual(filterReview(qs, { missTypes, links: {} }).map((q) => q.id), ['a', 'b', 'c']);
});

test('sortReview: forget/hard/wrong/subject で並ぶ', () => {
  const qs = [{ id: 'a', subject: 'い' }, { id: 'b', subject: 'あ' }];
  const srs = { a: { seen: 2, interval: 10, due: NOW + 9 * DAY }, b: { seen: 1, interval: 0 } };
  const history = [
    { questionId: 'a', correct: true }, { questionId: 'a', correct: true },
    { questionId: 'b', correct: false }, { questionId: 'b', correct: false },
  ];
  // forget: b(間隔0=最優先) が先
  assert.equal(sortReview(qs, 'forget', { srs, now: NOW })[0].id, 'b');
  // hard: 誤答率の高い b が先
  assert.equal(sortReview(qs, 'hard', { history })[0].id, 'b');
  // subject: あ→い
  assert.equal(sortReview(qs, 'subject', {})[0].subject, 'あ');
});
