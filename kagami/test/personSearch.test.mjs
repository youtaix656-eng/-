import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fold, terms, haystackOf, matchesAll, hitRanges, splitByHit, suggestTerms, pushHistory,
  QUICK_TERMS, HISTORY_MAX,
} from '../src/lib/personSearch.js';
import { PERSON_TYPES, allBehaviors } from '../src/data/people.js';

test('表記の揺れを吸収する（カタカナ・全角・大小・空白）', () => {
  assert.equal(fold('キゲン'), 'きげん');
  assert.equal(fold('ＡＢＣ'), 'abc');
  assert.equal(fold('機嫌 が　わるい'), '機嫌がわるい');
});

test('読み（ひらがな）で型を引ける', () => {
  const t = PERSON_TYPES.find((x) => x.id === 'mood_rules');
  const hay = haystackOf({ text: t.behaviors[0] }, { type: t });
  assert.ok(matchesAll(hay, terms('きげん')), '読みで引けません');
  assert.ok(matchesAll(hay, terms('機嫌')), '漢字でも引けること');
});

test('芯・場面の名前でも引ける', () => {
  const t = PERSON_TYPES.find((x) => x.id === 'mood_rules');
  const hay = haystackOf({ text: t.behaviors[0] }, { type: t, coreLabels: ['一貫性のなさ'], sceneLabels: ['職場・仕事'] });
  assert.ok(matchesAll(hay, terms('一貫性')));
  assert.ok(matchesAll(hay, terms('職場')));
});

test('スペース区切りは「すべて含む」（AND）', () => {
  assert.equal(matchesAll('機嫌で場を動かす 職場・仕事', terms('機嫌 職場')), true);
  assert.equal(matchesAll('機嫌で場を動かす', terms('機嫌 職場')), false);
  assert.equal(matchesAll('なんでも', terms('')), true, '空なら全部通す');
});

test('当たった所を返す（重ならない・元の位置）', () => {
  const src = '話が通じる日と通じない日';
  const r = hitRanges(src, terms('通じ'));
  assert.equal(r.length, 2);
  for (const x of r) assert.equal(src.slice(x.start, x.end), '通じ');
  const parts = splitByHit(src, terms('通じ'));
  assert.equal(parts.map((p) => p.text).join(''), src, '組み直すと元に戻ること');
  assert.ok(parts.some((p) => p.hit));
});

test('空・null でも落ちない', () => {
  for (const bad of ['', null, undefined]) {
    assert.deepEqual(terms(bad), []);
    assert.deepEqual(splitByHit(bad, []), []);
    assert.deepEqual(hitRanges(bad, terms('あ')), []);
  }
});

test('0件のときは候補を出すだけ（勝手に検索し直さない）', () => {
  const corpus = PERSON_TYPES.map((t) => ({ label: t.name, hay: t.reading }));
  const out = suggestTerms('きげんんん', corpus);
  assert.ok(out.includes('機嫌で場を動かす'), `候補が出ません: ${out}`);
  assert.ok(out.length <= 3, '候補は3つまで');
  assert.deepEqual(suggestTerms('あ', corpus), [], '1文字では候補を出さない');
});

test('検索の履歴は新しい順・重複なし・上限つき', () => {
  let h = [];
  for (let i = 0; i < HISTORY_MAX + 3; i += 1) h = pushHistory(h, `語${i}`);
  assert.equal(h.length, HISTORY_MAX);
  assert.equal(h[0], `語${HISTORY_MAX + 2}`);
  assert.deepEqual(pushHistory(['a', 'b'], 'b'), ['b', 'a'], '同じ語は上へ動かす');
  assert.deepEqual(pushHistory(['a'], '  '), ['a'], '空白だけは足さない');
});

test('よく使う入口は、実際に何か当たる語にする', () => {
  const texts = allBehaviors().map((b) => b.text).join(' ');
  const names = PERSON_TYPES.map((t) => `${t.name}${t.reading}`).join(' ');
  for (const q of QUICK_TERMS) {
    assert.ok(
      matchesAll(texts, terms(q)) || matchesAll(names, terms(q)),
      `入口の語「${q}」がどこにも当たりません`,
    );
  }
});

test('後読み（lookbehind）を使わない・ネットワークに触れない', () => {
  const src = readFileSync(new URL('../src/lib/personSearch.js', import.meta.url), 'utf8');
  assert.ok(!/\(\?<[=!]/.test(src), '後読みが使われています');
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|localStorage|indexedDB/);
});
