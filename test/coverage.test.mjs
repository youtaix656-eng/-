import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coverageBySubject,
  coverageLevel,
  coverageSummary,
  suggestedThresholds,
  neededToExitThin,
  DEFAULT_THIN_THRESHOLD,
  DEFAULT_RICH_THRESHOLD,
} from '../src/lib/coverage.js';

test('coverageLevel: 既定しきい値で分類する', () => {
  assert.equal(coverageLevel(0), 'none');
  assert.equal(coverageLevel(5), 'thin');
  assert.equal(coverageLevel(30), 'ok');
  assert.equal(coverageLevel(100), 'rich');
});

test('coverageLevel: しきい値を渡すとそちらを使う（#2）', () => {
  assert.equal(coverageLevel(15, { thin: 10, rich: 20 }), 'ok');
  assert.equal(coverageLevel(5, { thin: 10, rich: 20 }), 'thin');
});

test('suggestedThresholds: outlineの大項目数から目安を出す（#28）', () => {
  const outline = [{ no: '1' }, { no: '2' }, { no: '3' }];
  const t = suggestedThresholds(outline);
  assert.equal(t.thin, 12);
  assert.equal(t.rich, 36);
});

test('suggestedThresholds: outlineが無ければnull', () => {
  assert.equal(suggestedThresholds(null), null);
  assert.equal(suggestedThresholds([]), null);
});

test('neededToExitThin: 手薄脱出まであと何問か', () => {
  assert.equal(neededToExitThin({ total: 5, thinThreshold: 20 }), 15);
  assert.equal(neededToExitThin({ total: 25, thinThreshold: 20 }), 0);
});

test('coverageBySubject: 大項目｜中項目の内訳（subgroups）を作る（#1）', () => {
  const qs = [
    { id: '1', subject: '解剖学', genre: '運動器系｜骨' },
    { id: '2', subject: '解剖学', genre: '運動器系｜筋' },
    { id: '3', subject: '解剖学', genre: '運動器系｜骨' },
  ];
  const rows = coverageBySubject(qs, []);
  const kaibou = rows.find((r) => r.name === '解剖学');
  assert.equal(kaibou.total, 3);
  const g = kaibou.groups.find((x) => x.name === '運動器系');
  assert.equal(g.count, 3);
  const sub = g.subgroups.find((x) => x.name === '骨');
  assert.equal(sub.count, 2);
});

test('coverageBySubject: 原問（round設定あり）と画像/図つきの内訳を集計する（#4）', () => {
  const qs = [
    { id: '1', subject: '生理学', round: 30 },
    { id: '2', subject: '生理学', image: 'x.png' },
    { id: '3', subject: '生理学', figure: 'fig1' },
    { id: '4', subject: '生理学' },
  ];
  const rows = coverageBySubject(qs, []);
  const seiri = rows.find((r) => r.name === '生理学');
  assert.equal(seiri.format.original, 1);
  assert.equal(seiri.format.derived, 3);
  assert.equal(seiri.format.withImage, 2);
});

test('coverageBySubject: しきい値は既定値を持つ（outline無し科目）', () => {
  const rows = coverageBySubject([], []);
  const seiri = rows.find((r) => r.name === '生理学');
  assert.equal(seiri.thinThreshold, DEFAULT_THIN_THRESHOLD);
  assert.equal(seiri.richThreshold, DEFAULT_RICH_THRESHOLD);
  assert.equal(seiri.thresholdIsAuto, false);
});

test('coverageBySubject: outlineがある科目（医療概論）は自動しきい値になる（#28）', () => {
  const rows = coverageBySubject([], []);
  const iryou = rows.find((r) => r.name === '医療概論');
  assert.equal(iryou.thresholdIsAuto, true);
  assert.ok(iryou.thinThreshold > 0);
});

test('coverageBySubject: opts.thin/opts.richで全科目共通のしきい値に上書きできる（#2）', () => {
  const rows = coverageBySubject([], [], { thin: 5, rich: 15 });
  for (const r of rows) {
    assert.equal(r.thinThreshold, 5);
    assert.equal(r.richThreshold, 15);
    assert.equal(r.thresholdIsAuto, false);
  }
});

test('coverageSummary: fillRatio（充足率）を返す（#8）', () => {
  const rows = [
    { total: 0, thinThreshold: 20 },
    { total: 5, thinThreshold: 20 },
    { total: 50, thinThreshold: 20 },
    { total: 60, thinThreshold: 20 },
  ];
  const s = coverageSummary(rows);
  assert.equal(s.filled, 2); // 50問・60問の2科目だけ手薄でも未収録でもない
  assert.equal(s.fillRatio, 0.5);
});
