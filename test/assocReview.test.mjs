import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assocKey, comparisonKey, gradeAssoc, isAssocDue, orderByDue } from '../src/lib/assocReview.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

test('assocKey: 無向で安定、比較キー', () => {
  assert.equal(assocKey('心不全', '利尿薬'), assocKey('利尿薬', '心不全'));
  assert.equal(comparisonKey('tsufu-gitsufu'), 'cmp:tsufu-gitsufu');
});

test('gradeAssoc: 正解でボックスが進み due が延びる', () => {
  const k = assocKey('A', 'B');
  let m = {};
  m = gradeAssoc(m, k, true, NOW);
  assert.equal(m[k].box, 1);
  m = gradeAssoc(m, k, true, NOW);
  assert.equal(m[k].box, 2);
  assert.ok(m[k].due > NOW);
  m = gradeAssoc(m, k, false, NOW);
  assert.equal(m[k].box, 1, '失敗で最初へ');
});

test('isAssocDue: 未登録は対象、未来のdueは対象外', () => {
  const k = assocKey('A', 'B');
  assert.equal(isAssocDue({}, k, NOW), true);
  const m = gradeAssoc({}, k, true, NOW);
  assert.equal(isAssocDue(m, k, NOW), false); // 1日後
  assert.equal(isAssocDue(m, k, NOW + 2 * DAY), true);
});

test('orderByDue: 期限切れを先頭に', () => {
  const kA = assocKey('A', 'B');
  const kC = assocKey('C', 'D');
  const m = gradeAssoc({}, kA, true, NOW); // A-B は未来
  const items = [{ key: kA }, { key: kC }]; // C-D は未登録=due
  const ord = orderByDue(m, items, NOW);
  assert.equal(ord[0].key, kC);
});
