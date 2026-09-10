import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { flashTo, FLASH_ATTR, FLASH_MS } from '../src/lib/focus.js';

/** 最低限の document のふり（本物のブラウザでの確認はPlaywright QAで行う） */
function fakeDoc(ids = []) {
  const made = new Map();
  for (const id of ids) {
    const attrs = new Map();
    const classes = new Set();
    made.set(id, {
      id,
      scrolled: false,
      className: 'card',
      scrollIntoView() {
        this.scrolled = true;
      },
      setAttribute: (k, v) => attrs.set(k, v),
      removeAttribute: (k) => attrs.delete(k),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), has: (c) => classes.has(c) },
    });
  }
  return { doc: { getElementById: (id) => made.get(id) || null }, made };
}

test('flashJumpTargetsCorrectId: 指定したidの要素だけを運んで光らせる', () => {
  const { doc, made } = fakeDoc(['toc-term-a', 'toc-term-b']);
  assert.equal(flashTo('toc-term-a', doc), true);
  assert.equal(made.get('toc-term-a').scrolled, true);
  assert.equal(made.get('toc-term-a').getAttribute(FLASH_ATTR), 'on');
  // 指定していない方には触れない
  assert.equal(made.get('toc-term-b').scrolled, false);
  assert.equal(made.get('toc-term-b').getAttribute(FLASH_ATTR), null);
});

test('光らせる印を className に入れない（Reactに消される）', () => {
  const { doc, made } = fakeDoc(['toc-term-a']);
  flashTo('toc-term-a', doc);
  const el = made.get('toc-term-a');
  assert.equal(el.classList.has('flash'), false);
  assert.equal(el.className.includes('flash'), false);
  // classNameが書き直されても、data属性の印は残る
  el.className = 'card opened';
  assert.equal(el.getAttribute(FLASH_ATTR), 'on');
});

test('しばらくすると印は自分で外れる', async () => {
  const { doc, made } = fakeDoc(['toc-term-a']);
  flashTo('toc-term-a', doc);
  await new Promise((r) => setTimeout(r, FLASH_MS + 60));
  assert.equal(made.get('toc-term-a').getAttribute(FLASH_ATTR), null);
});

test('飛び先が無くても落ちない', () => {
  const { doc } = fakeDoc([]);
  assert.equal(flashTo('toc-none', doc), false);
  assert.equal(flashTo('', doc), false);
  assert.equal(flashTo(null, doc), false);
  assert.equal(flashTo('toc-term-a', null), false);
});

test('印の付け方と、光らせるCSSがそろっている', () => {
  const src = readFileSync(new URL('../src/lib/focus.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /classList/, 'focus.js: 印をclassListで付けています（Reactに消されます）');
  const css = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8');
  assert.match(css, new RegExp(`\\[${FLASH_ATTR}\\]`), `styles/index.css: [${FLASH_ATTR}] を光らせる指定がありません`);
});

test('lib/focus.js はReactに依存しない（アプリの依存が無い状態でも試験できる）', () => {
  const src = readFileSync(new URL('../src/lib/focus.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from ['"]react['"]/, 'focus.js: reactを読み込んでいます');
});
