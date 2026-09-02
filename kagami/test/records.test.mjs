import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeRecord, sortRecords, countByTactic, countByPlace, PLACES, PLACE_MAP } from '../src/lib/records.js';

test('記録は既定で本文を伏せる', () => {
  const r = makeRecord({ text: '090-1234-5678 に連絡しろと言われた', placeId: 'work' });
  assert.equal(r.masked, true);
  assert.doesNotMatch(r.text, /[0-9]/);
});

test('伏せずに残すことも選べる（ただし明示したときだけ）', () => {
  const r = makeRecord({ text: '090-1234-5678', keepRaw: true });
  assert.equal(r.masked, false);
  assert.match(r.text, /090/);
});

test('メモも伏せる（ここに名前が書かれやすい）', () => {
  const r = makeRecord({ note: '連絡先は a@b.com' });
  assert.doesNotMatch(r.note, /a@b\.com/);
});

test('記録に氏名・連絡先の欄を持たない', () => {
  const r = makeRecord({ text: 'x', placeId: 'work', name: '山田', phone: '090-0000-0000' });
  const keys = Object.keys(r);
  for (const forbidden of ['name', 'phone', 'email', 'who', 'person', 'contact']) {
    assert.ok(!keys.includes(forbidden), `${forbidden} の欄があります`);
  }
  // 渡されても取り込まない
  assert.equal(r.name, undefined);
});

test('記録に「相手が悪い」という判定を持たせない', () => {
  const r = makeRecord({ text: 'x'.repeat(20), tacticIds: ['guilt'] });
  for (const forbidden of ['verdict', 'score', 'risk', 'level', 'abusive']) {
    assert.ok(!(forbidden in r), `${forbidden} を持っています`);
  }
});

test('場面は決まった選択肢だけ（不明なものは その他 に寄せる）', () => {
  assert.equal(makeRecord({ placeId: 'work' }).placeId, 'work');
  assert.equal(makeRecord({ placeId: 'そんな場面はない' }).placeId, 'other');
  assert.equal(makeRecord({}).placeId, 'other');
  for (const p of PLACES) assert.ok(PLACE_MAP[p.id]);
});

test('同じ型を二重に数えない', () => {
  const r = makeRecord({ tacticIds: ['guilt', 'guilt', 'deadline', null] });
  assert.deepEqual(r.tacticIds, ['guilt', 'deadline']);
});

test('id は重複せず、新しい順に並べられる', () => {
  const a = makeRecord({ at: 1000 });
  const b = makeRecord({ at: 2000 });
  assert.notEqual(a.id, b.id);
  assert.deepEqual(sortRecords([a, b]).map((r) => r.at), [2000, 1000]);
});

test('型ごと・場面ごとの件数を数える（多い順）', () => {
  const rs = [
    makeRecord({ tacticIds: ['guilt'], placeId: 'home' }),
    makeRecord({ tacticIds: ['guilt', 'deadline'], placeId: 'home' }),
    makeRecord({ tacticIds: ['deadline'], placeId: 'work' }),
  ];
  assert.deepEqual(countByTactic(rs), [
    { tacticId: 'deadline', count: 2 },
    { tacticId: 'guilt', count: 2 },
  ].sort((a, b) => b.count - a.count || a.tacticId.localeCompare(b.tacticId)));
  const places = countByPlace(rs);
  assert.equal(places.find((p) => p.place.id === 'home').count, 2);
  assert.equal(places.find((p) => p.place.id === 'work').count, 1);
  assert.equal(places.length, 2, '0件の場面は出さない');
});

test('保存は端末内だけ（storage.js がネットワークに触れない）', () => {
  const src = readFileSync(new URL('../src/lib/storage.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//);
});
