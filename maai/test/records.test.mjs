import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRecord, sortRecords, countByTactic, countByPlace, PLACES } from '../src/lib/records.js';
import { mask, findPersonal, summarizePersonal, hasPersonal } from '../src/lib/privacy.js';

test('記録は氏名・連絡先の欄を持たない（場面だけ）', () => {
  const r = makeRecord({ text: 'こんにちは', placeId: 'date' });
  assert.equal(r.name, undefined);
  assert.equal(r.contact, undefined);
  assert.equal(r.partner, undefined);
  assert.ok(PLACES.some((p) => p.id === r.placeId));
});

test('本文は既定で伏せて保存する', () => {
  const r = makeRecord({ text: '連絡先は090-1234-5678です', placeId: 'message' });
  assert.equal(r.masked, true);
  assert.ok(!r.text.includes('1234'));
  assert.ok(r.text.includes('〔電話番号〕'));
});

test('そのまま残すと決めたときだけ、伏せない', () => {
  const r = makeRecord({ text: '090-1234-5678', placeId: 'message', keepRaw: true });
  assert.equal(r.masked, false);
  assert.ok(r.text.includes('090'));
});

test('メモも必ず伏せる（ここに名前が書かれやすい）', () => {
  const r = makeRecord({ text: 'あ'.repeat(10), note: 'test@example.com から連絡', keepRaw: true });
  assert.ok(r.note.includes('〔メール〕'));
});

test('伏せ字で桁数を数えられないようにする', () => {
  const a = mask('090-1234-5678');
  const b = mask('080-1111-2222');
  assert.equal(a, b, '別々の番号が別々の形で残っています');
  assert.ok(!/\d/.test(a), '数字が残っています');
});

test('見つけた個人情報の中身は返さない（種類と位置だけ）', () => {
  const found = findPersonal('連絡は 090-1234-5678 か test@example.com へ');
  assert.ok(found.length >= 2);
  for (const f of found) {
    assert.equal(f.value, undefined, '中身を返しています');
    assert.ok(typeof f.label === 'string');
  }
  assert.ok(hasPersonal('https://example.com'));
  assert.ok(summarizePersonal('090-1234-5678').some((s) => s.label === '電話番号'));
});

test('新しい順に並ぶ', () => {
  const list = [makeRecord({ at: 100 }), makeRecord({ at: 300 }), makeRecord({ at: 200 })];
  assert.deepEqual(sortRecords(list).map((r) => r.at), [300, 200, 100]);
});

test('数えるのは回数だけで、人の判定はしない', () => {
  const list = [
    makeRecord({ tacticIds: ['guilt', 'no_as_yes'], placeId: 'date' }),
    makeRecord({ tacticIds: ['guilt'], placeId: 'message' }),
  ];
  const counts = countByTactic(list);
  assert.deepEqual(counts[0], { tacticId: 'guilt', count: 2 });
  for (const c of counts) assert.equal(c.verdict, undefined);
  assert.equal(countByPlace(list).length, 2);
});

test('同じ型を2回書いても1回として持つ', () => {
  const r = makeRecord({ tacticIds: ['guilt', 'guilt'] });
  assert.deepEqual(r.tacticIds, ['guilt']);
});
