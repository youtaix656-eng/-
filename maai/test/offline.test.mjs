import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const libFiles = () =>
  readdirSync(new URL('../src/lib', import.meta.url))
    .filter((f) => f.endsWith('.js'))
    .map((f) => `src/lib/${f}`);

test('src/lib はネットワークに触れない（貼った文面が端末から出ないことの根拠）', () => {
  const banned = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource', 'import('];
  for (const f of libFiles()) {
    const src = read(f);
    for (const word of banned) {
      assert.ok(!src.includes(word), `${f}: ${word} が使われています`);
    }
  }
});

test('保存は localStorage だけ（サーバーを持たない）', () => {
  const src = read('src/lib/storage.js');
  assert.ok(src.includes('localStorage'));
  assert.ok(!src.includes('fetch('), 'storage.js が通信しています');
});

test('画面に出す文にマークダウンを書かない（そのまま表示されるため）', async () => {
  const mods = ['approach', 'tactics', 'consent', 'replies', 'habits', 'states', 'myths', 'sources'];
  for (const name of mods) {
    const mod = await import(`../src/data/${name}.js`);
    const walk = (value, path) => {
      if (typeof value === 'string') {
        assert.ok(!value.includes('**'), `${path}: マークダウンの強調が入っています`);
      } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
      else if (value && typeof value === 'object') {
        for (const k of Object.keys(value)) walk(value[k], `${path}.${k}`);
      }
    };
    for (const key of Object.keys(mod)) walk(mod[key], `${name}.${key}`);
  }
});

test('出典に URL を書かない（確かめられないリンクを作らない）', async () => {
  const { SOURCES } = await import('../src/data/sources.js');
  for (const s of SOURCES) {
    const text = JSON.stringify(s);
    assert.ok(!/https?:\/\//.test(text), `${s.tocTitle}: URL が入っています`);
    assert.equal(s.url, undefined, `${s.tocTitle}: url の欄があります`);
  }
});

test('出典は「研究かどうか」を必ず持ち、研究でないものが実際にある', async () => {
  const { SOURCES } = await import('../src/data/sources.js');
  for (const s of SOURCES) {
    assert.equal(typeof s.research, 'boolean', `${s.tocTitle}: research の欄がありません`);
    assert.ok(s.note, `${s.tocTitle}: 説明が空`);
  }
  assert.ok(SOURCES.some((s) => s.research === false), '研究でない出典が1件もないのは不自然');
});
