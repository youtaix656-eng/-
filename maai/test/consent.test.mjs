import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONSENT_POINTS, CONSENT_MAP } from '../src/data/consent.js';
import { SOURCE_MAP } from '../src/data/sources.js';

test('同意の項目は id・タイトルが重複せず、読みを持つ', () => {
  const ids = CONSENT_POINTS.map((c) => c.id);
  const titles = CONSENT_POINTS.map((c) => c.title);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(titles).size, titles.length);
  for (const c of CONSENT_POINTS) {
    assert.match(c.reading, /^[ぁ-ゖー・]+$/u, `${c.title}: reading が不正`);
  }
});

test('すべての項目が「代わりにできること」と出典を持つ', () => {
  for (const c of CONSENT_POINTS) {
    assert.ok(c.summary && c.detail, `${c.title}: 中身が空`);
    assert.ok(c.instead, `${c.title}: 代わりにできることが空`);
    assert.ok(c.sourceIds && c.sourceIds.length > 0, `${c.title}: 出典がありません`);
    for (const id of c.sourceIds) assert.ok(SOURCE_MAP[id], `${c.title}: 存在しない出典 ${id}`);
  }
});

test('同意を取り付ける手順を書かない', () => {
  const banned = ['言わせる', '言わせ方', 'うなずかせ', '断らせない', '同意を取る方法', 'その気にさせ', '流れで'];
  for (const c of CONSENT_POINTS) {
    const text = [c.summary, c.detail, c.instead].join(' ');
    for (const w of banned) {
      assert.ok(!text.includes(w), `${c.title}: 「${w}」が入っています（手順は書かない）`);
    }
  }
});

test('法律の要件を数字で断定しない（改正で変わるため）', () => {
  // 年齢・年数・条番号をアプリ側に持つと、古い数字が根拠として使われる。
  const numbers = /\d+\s*(歳|才|年以下|条)/;
  for (const c of CONSENT_POINTS) {
    const text = [c.summary, c.detail, c.instead].join(' ');
    assert.doesNotMatch(text, numbers, `${c.title}: 法律の数字が書かれています`);
  }
});

test('法律にふれる項目には「※要確認」を付ける', () => {
  for (const id of ['law', 'not_able']) {
    assert.equal(CONSENT_MAP[id].check, true, `${id}: ※要確認 が付いていません`);
  }
});

test('性別で書かない（誘う側・誘われる側のどちらにも同じ条件が掛かる）', () => {
  const bad = /(男性|女性|男|女)(は|が)[^、。]{0,8}(同意|断|求め)/;
  for (const c of CONSENT_POINTS) {
    const text = [c.summary, c.detail, c.instead].join(' ');
    assert.doesNotMatch(text, bad, `${c.title}: 性別で書かれています`);
  }
});

test('いちばん重い3件が必ず入っている', () => {
  for (const id of ['soft_no_is_no', 'not_able', 'can_stop']) {
    assert.ok(CONSENT_MAP[id], `${id} が見つかりません`);
  }
});
