import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ALLOWED_GLYPHS, GLYPHS } from '../src/data/glyphs.js';
import { CATEGORIES } from '../src/data/tactics.js';
import { REPLIES } from '../src/data/replies.js';
import { PLACES } from '../src/lib/records.js';
import { TOC_CATEGORIES } from '../src/data/toc.js';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

function srcFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (/\.(jsx?|css|html)$/.test(e.name)) out.push(`${dir}/${e.name}`);
    }
  };
  walk('src');
  out.push('index.html');
  return out;
}

test('画面に出る印は、すべて glyphs.js の一覧のもの', () => {
  const groups = [
    ['型のまとまり', CATEGORIES],
    ['返し方', REPLIES],
    ['場面', PLACES],
    ['目次のカテゴリ', TOC_CATEGORIES],
  ];
  for (const [label, items] of groups) {
    for (const item of items) {
      assert.ok(item.icon, `${label}: ${item.id} に印がありません`);
      assert.ok(
        ALLOWED_GLYPHS.has(item.icon),
        `${label}: ${item.id} の印「${item.icon}」が glyphs.js にありません`,
      );
    }
  }
});

test('絵文字を使わない（環境によって色が付き、モノクロが崩れるため）', () => {
  // 星の面（U+1F000 以降）・異体字セレクタ16（絵文字表示の指定）・色が付きやすい記号
  const astral = /[\u{1F000}-\u{1FAFF}]/u;
  const vs16 = /️/;
  const colorful = /[☀-☄☎☑☔☕☘☝☠☢☣☦☪☮☯☸-☺♀♂♈-♓♟♠♣♥♦♨♻♾♿⚒-⚗⚙⚛⚜⚠⚡⚪⚫⚰⚱⚽⚾⛄⛅⛈⛎⛏⛑⛓⛔⛩⛪⛰-⛺⛽✅✊-✍✨❌❎❓-❕❗❣❤➕-➗➡➰➿⬀-⯿]/u;
  for (const f of srcFiles()) {
    const src = read(f);
    assert.ok(!astral.test(src), `${f}: 絵文字（星の面の文字）が入っています`);
    assert.ok(!vs16.test(src), `${f}: 絵文字表示の指定（U+FE0F）が入っています`);
    const m = src.match(colorful);
    assert.ok(!m, `${f}: 色付きで描かれうる記号「${m && m[0]}」が入っています`);
  }
});

test('印どうしの形が重複しない（同じ形を別の意味に使わない）', () => {
  const values = Object.values(GLYPHS);
  assert.equal(new Set(values).size, values.length, '同じ記号が2つの名前に付いています');
});

test('CSS に色を持たない（すべて R=G=B の灰色だけ）', () => {
  const css = read('src/styles.css');

  const expand = (hex) => {
    if (hex.length === 3 || hex.length === 4) return [...hex.slice(0, 3)].map((c) => parseInt(c + c, 16));
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  };
  const hexes = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.ok(hexes.length > 0, '色の指定が1つも見つかりません（読み取りに失敗している）');
  for (const h of hexes) {
    const [r, g, b] = expand(h.slice(1));
    assert.ok(r === g && g === b, `${h}: 色が付いています（R=G=B ではない）`);
  }

  for (const fn of css.match(/rgba?\([^)]*\)/g) || []) {
    const [r, g, b] = fn.replace(/rgba?\(|\)/g, '').split(',').map((x) => parseFloat(x));
    assert.ok(r === g && g === b, `${fn}: 色が付いています`);
  }

  assert.doesNotMatch(css, /hsla?\(/, 'hsl() は使わない（色が入りやすい）');
  const named = /(?:^|[\s:])(red|blue|green|orange|yellow|purple|pink|brown|gold|teal|navy|cyan|magenta|crimson)\b/i;
  assert.doesNotMatch(css, named, '色の名前が使われています');
});

test('飾りの SVG に色を書かない（周りの文字の色を受け継ぐ）', () => {
  const src = read('src/components/Ornament.jsx');
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/, '飾りに色が直接書かれています');
  assert.doesNotMatch(src, /stroke="(?!currentColor|none)[^"]+"/, 'stroke は currentColor か none だけ');
  assert.doesNotMatch(src, /fill="(?!currentColor|none)[^"]+"/, 'fill は currentColor か none だけ');
});

test('画像を使うのは地の面だけ（飾りはその場で線を引く）', () => {
  // 2026-08-30 ユーザー了承：地に敷く面（src/assets/figures/*.webp）だけは画像で持つ。
  // それ以外は今までどおり、その場で線を引く（読み込む量を増やさないため）。
  for (const f of srcFiles()) {
    const src = read(f);
    const hits = (src.match(/[\w./-]+\.(png|jpe?g|gif|webp|avif)\b/gi) || [])
      .filter((x) => !x.includes('assets/figures/'));
    assert.deepEqual(hits, [], `${f}: 地の面以外で画像ファイルを参照しています`);
  }
});

test('地の面は灰色だけで描く（絵にも色を入れない）', () => {
  // 説明の行（// ではじまる）を除いた、実際の処理だけを見る
  const gen = read('tools/draw-figures.js')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  // 使ってよいのは g()（灰色を組み立てるもの）だけ。生の色指定を書かない
  assert.doesNotMatch(gen, /#[0-9a-fA-F]{3,8}\b/, '色が直接書かれています');
  assert.doesNotMatch(gen, /hsla?\(/, 'hsl() は使わない');
  for (const m of gen.match(/rgba?\([^)]*\)/g) || []) {
    // g() の中の組み立て（テンプレート文字列）だけは許す
    assert.match(m, /\$\{v\},\$\{v\},\$\{v\}/, `${m}: 灰色ではない色があります`);
  }
  const named = /(?:^|[\s:'"(])(red|blue|green|orange|yellow|purple|pink|brown|gold|teal|navy|cyan|magenta|crimson)\b/i;
  assert.doesNotMatch(gen, named, '色の名前が使われています');
});
