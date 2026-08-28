import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestUnvisitedFeature } from '../src/lib/featureDiscovery.js';
import featureRegistry from '../src/data/featureRegistry.js';

const FIXED_REGISTRY = [
  { id: 'a', title: 'A', view: 'a', desc: 'descA' },
  { id: 'b', title: 'B', view: 'b', desc: 'descB' },
  { id: 'c', title: 'C', view: 'c', desc: 'descC' },
  { id: 'a-sub', title: 'Asub', view: 'a', sub: true, desc: 'sub of a' },
  { id: 'home-thing', title: 'Home', view: 'home', desc: 'home itself' },
];

test('suggestUnvisitedFeature: 未訪問のものだけを候補にする', () => {
  const r = suggestUnvisitedFeature(FIXED_REGISTRY, ['a'], new Date('2026-08-28'));
  assert.ok(r);
  assert.equal(r.view, 'b'); // 唯一の未訪問standalone候補（cは後述で確認）は日付次第でb/cのどちらか
  assert.notEqual(r.view, 'a');
});

test('suggestUnvisitedFeature: sub:true の項目とview=homeは候補から除外する', () => {
  const r = suggestUnvisitedFeature(FIXED_REGISTRY, [], new Date('2026-08-28'));
  assert.ok(['b', 'c'].includes(r.view) || r.view === 'a');
  assert.notEqual(r.title, 'Home');
  // a-subのview('a')は候補a自体としてはカウントされるが、a-sub自体は選ばれない
  assert.notEqual(r.id, 'a-sub');
});

test('suggestUnvisitedFeature: 全部訪問済みならnullを返す', () => {
  const r = suggestUnvisitedFeature(FIXED_REGISTRY, ['a', 'b', 'c'], new Date('2026-08-28'));
  assert.equal(r, null);
});

test('suggestUnvisitedFeature: 同じ日なら同じ結果になる（安定性）', () => {
  const date = new Date('2026-08-28T09:00:00');
  const date2 = new Date('2026-08-28T22:00:00');
  const r1 = suggestUnvisitedFeature(FIXED_REGISTRY, [], date);
  const r2 = suggestUnvisitedFeature(FIXED_REGISTRY, [], date2);
  assert.equal(r1.id, r2.id);
});

test('suggestUnvisitedFeature: 日が変わると候補が変わりうる（複数候補がある場合）', () => {
  const results = new Set();
  for (let d = 1; d <= 10; d++) {
    const r = suggestUnvisitedFeature(FIXED_REGISTRY, [], new Date(`2026-08-${String(d).padStart(2, '0')}`));
    if (r) results.add(r.id);
  }
  assert.ok(results.size > 1, '10日分試して候補が1種類しか出ないのは日替わりになっていない');
});

test('suggestUnvisitedFeature: 実データ（featureRegistry.js）でも例外を投げない', () => {
  const r = suggestUnvisitedFeature(featureRegistry, [], new Date());
  assert.ok(r === null || (r.view && r.title));
  const allViews = featureRegistry.filter((f) => !f.sub).map((f) => f.view);
  const r2 = suggestUnvisitedFeature(featureRegistry, allViews, new Date());
  assert.equal(r2, null, '全部訪問済みにするとnullになるはず');
});
