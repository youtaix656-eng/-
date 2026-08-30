import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flashTo, FLASH_CLASS } from '../src/lib/focus.js';

/** DOM のふりをする最小のもの（React に依存させないので、素の JS で試せる） */
function fakeDoc(ids = []) {
  const seen = [];
  const els = new Map();
  for (const id of ids) {
    els.set(id, {
      scrollIntoView: (opt) => seen.push(['scroll', id, opt.block]),
      classList: { add: (c) => seen.push(['add', id, c]), remove: () => {} },
    });
  }
  return { getElementById: (id) => els.get(id) || null, seen };
}

test('飛び先まで運んで、一時的に光らせる', () => {
  const doc = fakeDoc(['toc-tactic-guilt']);
  assert.equal(flashTo('toc-tactic-guilt', doc), true);
  assert.deepEqual(doc.seen[0], ['scroll', 'toc-tactic-guilt', 'start']);
  assert.deepEqual(doc.seen[1], ['add', 'toc-tactic-guilt', FLASH_CLASS]);
});

test('飛び先が無くても落ちない', () => {
  const doc = fakeDoc([]);
  assert.equal(flashTo('toc-tactic-none', doc), false);
});

test('id が空でも落ちない', () => {
  assert.equal(flashTo('', fakeDoc([])), false);
  assert.equal(flashTo('x', null), false);
});
