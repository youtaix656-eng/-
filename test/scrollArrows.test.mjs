// 右端のスクロール矢印。画面から確かめられない決まりを、原文で見張る。
// （Ouro 側の ouro/test/arrows.test.mjs と同じ考え方で揃えてある）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const css = read('../src/styles/index.css');
const app = read('../src/App.jsx');
const cmp = read('../src/components/ScrollArrows.jsx');

/** styles/index.css から1つのセレクタの中身を取り出す。 */
function block(selector) {
  const i = css.indexOf(`${selector} {`);
  assert.ok(i >= 0, `${selector} が無い`);
  return css.slice(i, css.indexOf('}', i));
}

test('すべての画面に出す（即時に読み、画面の分岐の中に入れない）', () => {
  assert.match(app, /import ScrollArrows from '\.\/components\/ScrollArrows\.jsx'/);
  assert.match(app, /<ScrollArrows view=\{view\} \/>/);
  // lazy にしない（下部ナビ相当の常設UIなので）
  assert.ok(!/lazy\(\(\) => import\('\.\/components\/ScrollArrows/.test(app));
  // renderView の中（case の並び）に入れない — 入れるとその画面にしか出ない
  const rv = app.slice(app.indexOf('function renderView'), app.indexOf('return (', app.indexOf('function renderView')));
  assert.ok(!/ScrollArrows/.test(rv), 'renderView の中に置かない');
});

test('重なりはロードマップバー（28）・ミニプレーヤー（29）・下部ナビ（30）より下', () => {
  const z = Number((block('.scroll-arrows').match(/z-index:\s*(\d+)/) || [])[1]);
  assert.ok(z > 0 && z < 28, `z-index が ${z}`);
});

test('下部ナビとロードマップバーのぶんを空けて置く', () => {
  const b = block('.scroll-arrows');
  assert.match(b, /position:\s*fixed/);
  assert.match(b, /--nav-h/, '下部ナビの高さを見ていない');
  assert.match(b, /--roadmap-bar-h/, 'ロードマップバーの高さを見ていない');
  assert.match(b, /safe-area-inset-bottom/, '端末の下の余白を見ていない');
});

test('画面が広い時は本文の右端に寄せる（--max-w の外側へ飛ばさない）', () => {
  assert.match(block('.scroll-arrows'), /--max-w/);
});

test('動かない画面では丸ごと出さない（押しても何も起きないボタンを出さない）', () => {
  assert.match(cmp, /if \(!st\.show\) return null;/);
  assert.match(cmp, /show:\s*max > EDGE/);
});

test('端まで来た側は消さずに薄くする（位置が動くと押し損ねる）', () => {
  assert.match(cmp, /disabled=\{st\.atTop\}/);
  assert.match(cmp, /disabled=\{st\.atBottom\}/);
  assert.match(block('.scroll-arrows button:disabled'), /opacity/);
});

test('中身の高さが変わったら測り直す（lazy な画面は遅れて入る）', () => {
  assert.match(cmp, /ResizeObserver/);
  assert.match(cmp, /typeof ResizeObserver === 'function'/, '無い端末で落ちないようにする');
  assert.match(cmp, /\[view, measure\]/, 'ResizeObserver が無い端末の保険');
});

test('スクロールの見張りを毎回動かさない（rAF で間引き、必ず後片付けする）', () => {
  assert.match(cmp, /requestAnimationFrame/);
  assert.match(cmp, /\{ passive: true \}/);
  assert.match(cmp, /removeEventListener\('scroll'/);
  assert.match(cmp, /ro\.disconnect\(\)/);
});

test('動きを減らす設定を尊重する', () => {
  assert.match(cmp, /prefers-reduced-motion/);
  assert.match(cmp, /behavior: reduce \? 'auto' : 'smooth'/);
});

test('1回で動くのは1画面ぶん（全部だと前後が見えなくなる）', () => {
  const step = Number((cmp.match(/const STEP = ([\d.]+);/) || [])[1]);
  assert.ok(step > 0.5 && step < 1, `STEP が ${step}`);
});

test('読み上げ用の名前が付いている', () => {
  assert.match(cmp, /aria-label="1画面ぶん上へ"/);
  assert.match(cmp, /aria-label="1画面ぶん下へ"/);
});

test('ミニプレーヤーの位置の決まりを壊していない', () => {
  // ミニプレーヤーは、ロードマップバーが出ている画面だけ1段上がる（.lifted）。
  // 矢印を足したことで、この決まりが変わっていないことを確かめる。
  assert.match(css, /\.mini-player\.lifted/);
  assert.match(block('.mini-player.lifted'), /--roadmap-bar-h/);
});
