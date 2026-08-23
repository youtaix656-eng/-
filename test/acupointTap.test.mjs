import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHit, toViewBoxCoords, buildChoices, ACUPOINT_TAP_POINTS, HIT_TOLERANCE } from '../src/lib/acupointTap.js';

test('isHit: 許容半径内はヒット、範囲外は外れ', () => {
  const point = { cx: 100, cy: 100 };
  assert.equal(isHit(100, 100, point), true); // ぴったり
  assert.equal(isHit(100 + HIT_TOLERANCE - 1, 100, point), true); // 許容内
  assert.equal(isHit(100 + HIT_TOLERANCE + 10, 100, point), false); // 範囲外
});

test('toViewBoxCoords: コンテナ座標をviewBox座標へスケール変換する', () => {
  const rect = { left: 0, top: 0, width: 120, height: 100 }; // viewBoxの半分サイズで表示
  const out = toViewBoxCoords(60, 50, rect, '0 0 240 200');
  assert.equal(out.x, 120);
  assert.equal(out.y, 100);
});

test('toViewBoxCoords: rectのoffset（left/top）を考慮する', () => {
  const rect = { left: 10, top: 20, width: 240, height: 200 };
  const out = toViewBoxCoords(10 + 98, 20 + 92, rect, '0 0 240 200');
  assert.equal(out.x, 98);
  assert.equal(out.y, 92);
});

test('buildChoices: 正解を含み、指定件数の重複なし選択肢を作る', () => {
  const allNames = ['合谷', '足三里', '曲池', '三陰交', '太衝'];
  const choices = buildChoices('合谷', allNames, 4, () => 0.5);
  assert.equal(choices.length, 4);
  assert.ok(choices.includes('合谷'));
  assert.equal(new Set(choices).size, 4); // 重複なし
});

test('ACUPOINT_TAP_POINTS: 各図キーに対応する既存のfiguresが必要（データの整合性確認）', () => {
  for (const p of ACUPOINT_TAP_POINTS) {
    assert.ok(p.figureKey && p.blankFigureKey && p.viewBox);
    assert.equal(typeof p.cx, 'number');
    assert.equal(typeof p.cy, 'number');
  }
});
