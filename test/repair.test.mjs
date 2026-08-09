import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOrphans, orphanCount, repairData } from '../src/lib/repair.js';

test('computeOrphans: 問題バンクに無いidだけを孤立として検出', () => {
  const ids = ['q1', 'q2'];
  const srs = { q1: {}, q2: {}, ghost: {} };
  const memos = { q1: 'm', dead: 'x' };
  const links = { q2: {}, zzz: {} };
  const o = computeOrphans(ids, srs, memos, links);
  assert.deepEqual(o.srs, ['ghost']);
  assert.deepEqual(o.memos, ['dead']);
  assert.deepEqual(o.links, ['zzz']);
  assert.equal(orphanCount(o), 3);
});

test('computeOrphans: Set入力も可、孤立なしは0', () => {
  const o = computeOrphans(new Set(['a']), { a: {} }, {}, {});
  assert.equal(orphanCount(o), 0);
});

test('repairData: 孤立を掃除して保存、件数を返す', async () => {
  const db = {
    questions: [{ id: 'q1' }, { id: 'q2' }],
    srs: { q1: { seen: 1 }, ghost: { seen: 9 } },
    memos: { dead: 'x' },
    links: { q2: {} },
  };
  const storage = {
    loadQuestions: async () => db.questions,
    loadSrs: async () => db.srs,
    loadMemos: async () => db.memos,
    loadLinks: async () => db.links,
    saveSrs: async (v) => { db.srs = v; },
    saveMemos: async (v) => { db.memos = v; },
    saveLinks: async (v) => { db.links = v; },
  };
  const r = await repairData(storage);
  assert.equal(r.removed, 2); // ghost(srs) + dead(memos)
  assert.deepEqual(Object.keys(db.srs), ['q1']);
  assert.deepEqual(Object.keys(db.memos), []);
  assert.deepEqual(Object.keys(db.links), ['q2']);
});

test('repairData: 問題バンクが空なら誤削除せずスキップ', async () => {
  const db = { srs: { ghost: {} } };
  const storage = {
    loadQuestions: async () => [],
    loadSrs: async () => db.srs,
    loadMemos: async () => ({}),
    loadLinks: async () => ({}),
    saveSrs: async () => { throw new Error('保存してはいけない'); },
    saveMemos: async () => {},
    saveLinks: async () => {},
  };
  const r = await repairData(storage);
  assert.equal(r.skipped, true);
  assert.equal(r.removed, 0);
  assert.deepEqual(Object.keys(db.srs), ['ghost'], '空バンク時は消さない');
});
