import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { flashTo, FLASH_CLASS } from '../src/lib/focus.js';

/** 最低限の document のふり（本物のブラウザは e2e で見る） */
function fakeDoc(ids = []) {
  const made = new Map();
  for (const id of ids) {
    const classes = new Set();
    made.set(id, {
      id,
      scrolled: false,
      scrollIntoView() {
        this.scrolled = true;
      },
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
  assert.equal(el.classList.has(FLASH_CLASS), true);
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

test('lib/ は React に依存しない（アプリの依存なしでも試験できる）', () => {
  for (const f of ['focus.js', 'detect.js', 'privacy.js', 'records.js', 'storage.js']) {
    const src = readFileSync(new URL(`../src/lib/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /from 'react'/, `lib/${f}: react を読み込んでいます`);
  }
});
