// このアプリの決まりを機械チェックする（README の「決まり」と対応）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EFFECTS } from '../src/data/effects.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}
const srcFiles = walk(SRC).filter((f) => /\.(ts|tsx|css)$/.test(f));
const codeFiles = srcFiles.filter((f) => /\.(ts|tsx)$/.test(f));
const read = (f: string) => readFileSync(f, 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('src/lib はネットワークに触れない', () => {
  for (const f of codeFiles.filter((x) => x.includes(`${join('src', 'lib')}`))) {
    const s = stripComments(read(f));
    assert.doesNotMatch(s, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/, f);
  }
});

test('日付を UTC で扱わない', () => {
  for (const f of codeFiles) {
    const s = stripComments(read(f));
    assert.doesNotMatch(s, /toISOString\(/, f);
    assert.doesNotMatch(s, /new Date\(\s*['"`]\d{4}-\d{2}-\d{2}/, f);
  }
});

test('効果の評価は4段階で、点数を画面に出さない', () => {
  assert.equal(EFFECTS.length, 4);
  for (const f of codeFiles.filter((x) => x.endsWith('.tsx'))) {
    const s = stripComments(read(f));
    assert.doesNotMatch(s, /\.rank\b/, `${f} が rank（並び替え専用）を画面に出している`);
  }
});

test('平均を出す関数を持たない（VASは幅と件数だけ）', () => {
  for (const f of codeFiles) {
    const s = stripComments(read(f));
    assert.doesNotMatch(s, /\b(average|mean)[A-Za-z]*\s*\(/, f);
  }
});

test('診断する言い回しを持たない', () => {
  for (const f of srcFiles) {
    const s = stripComments(read(f));
    assert.doesNotMatch(s, /診断します|あなたは.*症です|危険度/, f);
  }
});

test('画面に出す文にマークダウンを書かない', () => {
  for (const f of codeFiles.filter((x) => x.endsWith('.tsx'))) {
    assert.doesNotMatch(stripComments(read(f)), /\*\*[^*]+\*\*/, f);
  }
});
