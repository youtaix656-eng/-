// 右端のスクロール矢印。画面から確かめられない決まりを、原文で見張る。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const css = read('../src/styles.css');
const app = read('../src/App.jsx');
const cmp = read('../src/components/ScrollArrows.jsx');

/** styles.css から1つのセレクタの中身を取り出す。 */
function block(selector) {
  const i = css.indexOf(`${selector} {`);
  assert.ok(i >= 0, `${selector} が無い`);
  return css.slice(i, css.indexOf('}', i));
}

test('すべての画面に出す（App.jsx で即時に読み、画面の切り替えに含めない）', () => {
  assert.match(app, /import ScrollArrows from '\.\/components\/ScrollArrows\.jsx'/);
  assert.match(app, /<ScrollArrows view=\{view\} \/>/);
  // view === '...' の分岐の中に入れない（入れるとその画面にしか出ない）
  assert.ok(!/view === '[^']+' && <ScrollArrows/.test(app));
});

test('重なりは会社バー（39）・ナビ（40）・モーダル（60）より下', () => {
  const z = Number((block('.scroll-arrows').match(/z-index:\s*(\d+)/) || [])[1]);
  assert.ok(z > 0 && z < 39, `z-index が ${z}`);
});

test('合成レイヤーを増やさない（新項目19）', () => {
  const b = block('.scroll-arrows');
  assert.ok(!/backdrop-filter/.test(b), 'backdrop-filter を付けない');
  assert.ok(!/will-change/.test(b), 'will-change を付けない');
  // .nav / .company-bar / .topbar の並びにも足さない
  const rule = css.slice(css.indexOf('.nav,\n.company-bar,\n.topbar'));
  assert.ok(!/scroll-arrows/.test(rule.slice(0, 200)));
});

test('下部ナビと会社バーのぶんを空けて置く', () => {
  const b = block('.scroll-arrows');
  assert.match(b, /position:\s*fixed/);
  assert.match(b, /right:/);
  assert.match(b, /--nav-h/, '下部ナビの高さを見ていない');
  assert.match(b, /safe-area-inset-bottom/, '端末の下の余白を見ていない');
});

test('動かない画面では丸ごと出さない（押しても何も起きないボタンを出さない）', () => {
  assert.match(cmp, /if \(!st\.show\) return null;/);
  assert.match(cmp, /show:\s*max > EDGE/);
});

test('端まで来た側は消さずに薄くする（位置が動くと押し損ねる）', () => {
  assert.match(cmp, /disabled=\{st\.atTop\}/);
  assert.match(cmp, /disabled=\{st\.atBottom\}/);
  assert.ok(!/st\.atTop \?\s*null/.test(cmp), '端で消さない');
  assert.match(block('.scroll-arrows button:disabled'), /opacity/);
});

test('中身の高さが変わったら測り直す（lazy な画面は遅れて入る）', () => {
  assert.match(cmp, /ResizeObserver/);
  assert.match(cmp, /typeof ResizeObserver === 'function'/, '無い端末で落ちないようにする');
  assert.match(cmp, /\[view, measure\]/, 'ResizeObserver が無い端末の保険');
});

test('スクロールの見張りを毎回動かさない（rAF で間引く）', () => {
  assert.match(cmp, /requestAnimationFrame/);
  assert.match(cmp, /\{ passive: true \}/, 'scroll は passive で聞く');
  assert.match(cmp, /removeEventListener\('scroll'/, '後片付けをする');
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

test('知らせの文は resume.js からも読める（切り出しても読み込み方を変えない）', async () => {
  const { doneMessage } = await import('../src/lib/resume.js');
  const direct = await import('../src/lib/announce.js');
  assert.equal(doneMessage([1]), '成果物が完成しました！');
  assert.equal(direct.doneMessage([1, 2]), '成果物が2件 完成しました！');
  assert.equal(doneMessage([]), '');
  // 起動時は小さい方だけを読む
  assert.match(app, /from '\.\/lib\/announce\.js'/);
  assert.ok(!/from '\.\/lib\/resume\.js'/.test(app), 'App.jsx から resume.js を読まない');
});
