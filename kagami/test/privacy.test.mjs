import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPersonal, summarizePersonal, mask, hasPersonal, PERSONAL_KINDS } from '../src/lib/privacy.js';

test('電話番号・メール・リンク・長い数字を見つける', () => {
  const kinds = (s) => findPersonal(s).map((f) => f.kind);
  assert.ok(kinds('090-1234-5678 まで').includes('phone'));
  assert.ok(kinds('a.b@example.co.jp へ').includes('email'));
  assert.ok(kinds('https://example.com/a を見て').includes('url'));
  assert.ok(kinds('口座 1234567890123 です').includes('account'));
});

test('伏せ字で桁数を数えられないようにする（別々の番号が同じ札になる）', () => {
  assert.equal(mask('090-1111-1111'), mask('080-2222-3333'));
  assert.doesNotMatch(mask('090-1111-1111'), /[0-9●*]/, '数字や伏せ字が残っています');
});

test('見つけたものの中身は返さない（種類と位置だけ）', () => {
  for (const f of findPersonal('090-1234-5678 と a@b.com')) {
    assert.deepEqual(Object.keys(f).sort(), ['end', 'kind', 'label', 'start']);
  }
  for (const s of summarizePersonal('090-1234-5678 と a@b.com')) {
    assert.deepEqual(Object.keys(s).sort(), ['count', 'label']);
  }
});

test('同じ箇所を二重に伏せない（電話番号が「長い数字」にも当たる）', () => {
  const spots = findPersonal('090-1234-5678');
  assert.equal(spots.length, 1);
  assert.equal(spots[0].kind, 'phone');
});

test('個人情報が無ければ、文面はそのまま', () => {
  const s = '明日の10時に会議室で待っています。';
  assert.equal(mask(s), s);
  assert.equal(hasPersonal(s), false);
});

test('伏せても前後の文はそのまま残る（資料として読めなくならない）', () => {
  const out = mask('連絡は 090-1234-5678 へ、と言われました。');
  assert.ok(out.startsWith('連絡は '));
  assert.ok(out.endsWith('へ、と言われました。'));
});

test('空文字・null でも落ちない', () => {
  for (const bad of ['', null, undefined]) {
    assert.equal(mask(bad), '');
    assert.deepEqual(findPersonal(bad), []);
    assert.equal(hasPersonal(bad), false);
  }
});

test('種類ごとに札があり、札に数字が入っていない', () => {
  for (const k of PERSONAL_KINDS) {
    assert.ok(k.token && k.token.length > 0, `${k.id}: 札がありません`);
    assert.doesNotMatch(k.token, /[0-9]/, `${k.id}: 札に数字が入っています`);
  }
});
