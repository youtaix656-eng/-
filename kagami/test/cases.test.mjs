import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeCase, updateCase, sortCases, displayName, LABEL_MAX, NOTE_MAX } from '../src/lib/cases.js';
import { analyzePerson } from '../src/lib/analysis.js';
import { PERSON_TYPES, allBehaviors } from '../src/data/people.js';

test('保存するのはチェックした内容だけ（判定を持たない）', () => {
  const c = makeCase({ checkedIds: ['mood_rules:0', 'mood_rules:1'] });
  assert.deepEqual(c.checkedIds, ['mood_rules:0', 'mood_rules:1']);
  for (const bad of ['score', 'verdict', 'risk', 'level', 'types', 'matches', 'result']) {
    assert.ok(!(bad in c), `${bad} を保存しています`);
  }
});

test('判定はあとから計算し直せる（型が変わっても過去の見立てを読める）', () => {
  const ids = ['mood_rules:0', 'mood_rules:1', 'mood_rules:2'];
  const c = makeCase({ checkedIds: ids });
  const r = analyzePerson(c.checkedIds, PERSON_TYPES);
  assert.equal(r.status, 'ok');
  assert.equal(r.matches[0].type.id, 'mood_rules');
});

test('氏名・連絡先の欄を持たない（あるのは呼び名だけ）', () => {
  const c = makeCase({ name: '山田太郎', phone: '090-0000-0000', email: 'a@b.com' });
  for (const bad of ['name', 'phone', 'email', 'address', 'contact', 'person']) {
    assert.ok(!(bad in c), `${bad} の欄があります`);
  }
});

test('呼び名とメモに混ざった連絡先は伏せる', () => {
  const c = makeCase({ label: 'Aさん 090-1234-5678', note: '連絡は a@b.com へ' });
  assert.doesNotMatch(c.label, /\d{3}-\d{4}/);
  assert.doesNotMatch(c.note, /a@b\.com/);
  assert.match(c.label, /Aさん/, '呼び名そのものは残ること');
});

test('長すぎる本文を貼り付けて記録にできない', () => {
  const c = makeCase({ label: 'あ'.repeat(200), note: 'い'.repeat(2000) });
  assert.ok(c.label.length <= LABEL_MAX);
  assert.ok(c.note.length <= NOTE_MAX);
});

test('同じふるまいを二重に持たない', () => {
  const c = makeCase({ checkedIds: ['a:0', 'a:0', 'b:1', null] });
  assert.deepEqual(c.checkedIds, ['a:0', 'b:1']);
});

test('直しても id と作成日時は変わらない', () => {
  const a = makeCase({ label: '前', checkedIds: ['a:0'], at: 1000 });
  const b = updateCase(a, { label: '後', checkedIds: ['a:0', 'b:1'] }, 2000);
  assert.equal(b.id, a.id);
  assert.equal(b.createdAt, a.createdAt);
  assert.equal(b.updatedAt, 2000);
  assert.equal(b.label, '後');
  assert.deepEqual(b.checkedIds, ['a:0', 'b:1']);
});

test('渡さなかった項目は消えない', () => {
  const a = makeCase({ label: '呼び名', note: 'メモ', sceneId: 'work', checkedIds: ['a:0'] });
  const b = updateCase(a, { checkedIds: ['a:0', 'a:1'] });
  assert.equal(b.label, '呼び名');
  assert.equal(b.note, 'メモ');
  assert.equal(b.sceneId, 'work');
});

test('新しく直したものが上に来る', () => {
  const a = makeCase({ at: 1000 });
  const b = makeCase({ at: 3000 });
  const c = makeCase({ at: 2000 });
  assert.deepEqual(sortCases([a, b, c]).map((x) => x.updatedAt), [3000, 2000, 1000]);
});

test('id は重複しない', () => {
  const ids = new Set([makeCase({ at: 1 }).id, makeCase({ at: 1 }).id, makeCase({ at: 1 }).id]);
  assert.equal(ids.size, 3);
});

test('呼び名が空でも一覧で見分けられる（氏名を強いない）', () => {
  const c = makeCase({ at: Date.parse('2026-08-29T10:00:00') });
  assert.match(displayName(c), /の見立て$/);
  assert.equal(displayName(makeCase({ label: '職場のAさん' })), '職場のAさん');
});

test('保存したふるまいの id は、いまのカタログに実在する', () => {
  const known = new Set(allBehaviors().map((b) => b.id));
  const c = makeCase({ checkedIds: [...known].slice(0, 3) });
  for (const id of c.checkedIds) assert.ok(known.has(id), `${id} が見つかりません`);
});

test('保存はネットワークに触れない', () => {
  const src = readFileSync(new URL('../src/lib/cases.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//);
});
