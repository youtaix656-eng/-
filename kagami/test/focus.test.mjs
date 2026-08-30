import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { flashTo, FLASH_ATTR, FLASH_MS } from '../src/lib/focus.js';

/** 最低限の document のふり（本物のブラウザは e2e で見る） */
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

test('飛び先があれば運んで光らせる', () => {
  const { doc, made } = fakeDoc(['toc-reply-takeout']);
  assert.equal(flashTo('toc-reply-takeout', doc), true);
  const el = made.get('toc-reply-takeout');
  assert.equal(el.scrolled, true);
  assert.equal(el.getAttribute(FLASH_ATTR), 'on');
});

test('光らせる印を className に入れない（React に消される）', () => {
  const { doc, made } = fakeDoc(['toc-tactic-lowball']);
  flashTo('toc-tactic-lowball', doc);
  const el = made.get('toc-tactic-lowball');
  // 飛び先のカードは「開く」で className が変わる。印が class だと
  // 次の描き直しで React が className を書き直し、印だけが消える。
  assert.equal(el.classList.has('flash'), false);
  assert.equal(el.className.includes('flash'), false);
  // その className を React が書き直しても、印は残っていること
  el.className = 'card opened';
  assert.equal(el.getAttribute(FLASH_ATTR), 'on');
});

test('しばらくすると印は自分で外れる', async () => {
  const { doc, made } = fakeDoc(['toc-reply-takeout']);
  flashTo('toc-reply-takeout', doc);
  const el = made.get('toc-reply-takeout');
  await new Promise((r) => setTimeout(r, FLASH_MS + 60));
  assert.equal(el.getAttribute(FLASH_ATTR), null);
});

test('飛び先が無くても落ちない（false を返すだけ）', () => {
  const { doc } = fakeDoc([]);
  assert.equal(flashTo('toc-tactic-none', doc), false);
  assert.equal(flashTo('', doc), false);
  assert.equal(flashTo(null, doc), false);
});

test('document が無い環境でも落ちない', () => {
  assert.equal(flashTo('toc-reply-takeout', null), false);
});

test('印の付け方と、光らせる CSS がそろっている', () => {
  const src = readFileSync(new URL('../src/lib/focus.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /classList/, 'focus.js: 印を classList で付けています（React に消されます）');
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, new RegExp(`\\[${FLASH_ATTR}\\]`), `styles.css: [${FLASH_ATTR}] を光らせる指定がありません`);
});

test('lib/ は React に依存しない（アプリの依存なしでも試験できる）', () => {
  for (const f of ['focus.js', 'detect.js', 'privacy.js', 'records.js', 'storage.js']) {
    const src = readFileSync(new URL(`../src/lib/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /from 'react'/, `lib/${f}: react を読み込んでいます`);
  }
});
