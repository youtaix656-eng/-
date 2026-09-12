import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_REGIONS, regionFullLabel, regionGroups, regionLabel, sideLabel } from '../src/data/bodyRegions.js';

test('部位 id は重複しない', () => {
  const ids = BODY_REGIONS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('左右のある部位は必ず対で存在し、片方だけになっていない', () => {
  for (const r of BODY_REGIONS) {
    if (!r.side) continue;
    const base = r.id.replace(/_(l|r)$/, '');
    const other = r.side === 'left' ? `${base}_r` : `${base}_l`;
    const pair = BODY_REGIONS.find((x) => x.id === other);
    assert.ok(pair, `${r.id} の対 ${other} が無い`);
    assert.equal(pair.label, r.label);
    assert.equal(pair.view, r.view);
  }
});

test('前面図では本人の右が画面左（x が小さい）、背面図では画面右になる', () => {
  for (const r of BODY_REGIONS) {
    if (!r.side) continue;
    const cx = r.shape.kind === 'ellipse' ? r.shape.cx : r.shape.x + r.shape.w / 2;
    const onScreenLeft = cx < 100;
    if (r.view === 'front') assert.equal(onScreenLeft, r.side === 'right', `${r.id}`);
    else assert.equal(onScreenLeft, r.side === 'left', `${r.id}`);
  }
});

test('すべての部位が読みを持つ（漢字の読みを機械で当てない）', () => {
  for (const r of BODY_REGIONS) {
    assert.ok(r.reading && /^[ぁ-んー]+$/.test(r.reading), `${r.id} の読み: ${r.reading}`);
  }
});

test('正中の部位は side を持たない・図の中央にある', () => {
  for (const r of BODY_REGIONS) {
    if (r.side) continue;
    const cx = r.shape.kind === 'ellipse' ? r.shape.cx : r.shape.x + r.shape.w / 2;
    assert.equal(cx, 100, r.id);
  }
});

test('表示名（左右つき）と絞り込み用のまとまり', () => {
  assert.equal(regionFullLabel('shoulder_front_l', 'left'), '左 肩');
  assert.equal(regionFullLabel('shoulder_front_l', 'both'), '両側 肩');
  assert.equal(regionFullLabel('lower_back', null), '腰');
  assert.equal(regionLabel('nope'), 'nope');
  assert.equal(sideLabel(null), '');
  const g = regionGroups();
  const shoulder = g.find((x) => x.key === 'shoulder_front');
  assert.deepEqual(shoulder?.ids.sort(), ['shoulder_front_l', 'shoulder_front_r']);
  const labels = g.map((x) => x.label);
  assert.equal(new Set(labels).size, labels.length, '絞り込みの表示名が重複している');
});
