import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// 記録はこの端末の中だけ。**src/lib はネットワークに触れない。**
// お通じと食事の記録は、健康の記録の中でもとりわけ人に見られたくないもの。

const LIB = new URL('../src/lib/', import.meta.url).pathname;
const DATA = new URL('../src/data/', import.meta.url).pathname;

function read(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...read(path));
    else if (/\.jsx?$/.test(name)) out.push({ path, text: readFileSync(path, 'utf8') });
  }
  return out;
}

const files = [...read(LIB), ...read(DATA)];

test('送る仕組みを持たない', () => {
  for (const file of files) {
    for (const bad of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /navigator\.sendBeacon/, /EventSource/, /import\s*\(/]) {
      assert.doesNotMatch(file.text, bad, `${file.path}: ${bad}`);
    }
  }
});

test('保存先は端末の中だけ（localStorage）', () => {
  const storage = files.find((f) => f.path.endsWith('storage.js'));
  assert.ok(storage);
  assert.match(storage.text, /localStorage/);
  assert.doesNotMatch(storage.text, /https?:/);
});

test('保存できなかったことを黙らない', () => {
  const storage = files.find((f) => f.path.endsWith('storage.js'));
  // 書けたかどうかを返す（true を返しっぱなしにしない）
  assert.match(storage.text, /return writeRaw/);
});
