import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISEASES, DISEASE_GROUPS, DISEASE_ACTIONS, DISEASE_MAP, diseasesByGroup } from '../src/data/diseases.js';
import { LOW_BACK_PATTERNS } from '../src/data/patterns.js';
import { LOW_BACK_RED_FLAGS } from '../src/data/redFlags.js';
import { SOURCE_MAP } from '../src/data/sources.js';
import { readingInfo, OTHER_GROUP } from '../src/lib/yomi.js';

test('疾患カードは129件（初回100＋追加29）、グループ構成どおり', () => {
  assert.equal(DISEASES.length, 129);
  const counts = Object.fromEntries(diseasesByGroup().map(({ group, items }) => [group.id, items.length]));
  assert.deepEqual(counts, {
    spine: 28, soft: 18, nerve: 19, visceral: 19, uro: 12, psych: 12, trauma: 15, redflag: 6,
  });
});

test('IDとタイトルは重複しない', () => {
  const ids = DISEASES.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'IDが重複しています');
  const titles = DISEASES.map((d) => d.title);
  const dup = titles.filter((t, i) => titles.indexOf(t) !== i);
  assert.deepEqual(dup, [], `タイトルが重複: ${dup.join('、')}`);
});

test('すべての疾患に読み・概要・見分けるポイント・施術の目安がある', () => {
  for (const d of DISEASES) {
    assert.ok(d.reading, `${d.title}: reading がありません`);
    assert.match(d.reading, /^[ぁ-ゖー・]+$/u, `${d.title}: reading「${d.reading}」がひらがなではありません`);
    assert.ok(d.summary && d.summary.length > 10, `${d.title}: summary が不足`);
    assert.ok(Array.isArray(d.signs) && d.signs.length >= 3, `${d.title}: signs が3件未満`);
    assert.ok(d.actionNote && d.actionNote.length > 5, `${d.title}: actionNote が不足`);
  }
});

test('読みはすべて あ〜ん / A〜Z に振り分けられる（「その他」に落ちない）', () => {
  for (const d of DISEASES) {
    assert.notEqual(readingInfo(d.title, d.reading).group, OTHER_GROUP, `${d.title}: 読みが不正`);
  }
});

test('action は定義済みの4種類のみ', () => {
  for (const d of DISEASES) {
    assert.ok(DISEASE_ACTIONS[d.action], `${d.title}: 未知の action「${d.action}」`);
  }
});

test('group はすべて定義済み', () => {
  const known = new Set(DISEASE_GROUPS.map((g) => g.id));
  for (const d of DISEASES) assert.ok(known.has(d.group), `${d.title}: 未知の group`);
});

test('関連リンク（patternId / flagId）はすべて実在する', () => {
  const patterns = new Set(LOW_BACK_PATTERNS.map((p) => p.id));
  const flags = new Set(LOW_BACK_RED_FLAGS.map((f) => f.id));
  for (const d of DISEASES) {
    if (d.patternId) assert.ok(patterns.has(d.patternId), `${d.title}: 存在しない patternId「${d.patternId}」`);
    if (d.flagId) assert.ok(flags.has(d.flagId), `${d.title}: 存在しない flagId「${d.flagId}」`);
  }
});

test('出典IDはすべて実在する（根拠のない医療情報を置かない）', () => {
  for (const d of DISEASES) {
    assert.ok(Array.isArray(d.sourceIds) && d.sourceIds.length > 0, `${d.title}: 出典がありません`);
    for (const id of d.sourceIds) assert.ok(SOURCE_MAP[id], `${d.title}: 未知の出典ID「${id}」`);
  }
});

test('緊急・受診レベルの疾患は施術可（treat）に分類されていない', () => {
  const mustNotTreat = [
    'cauda_equina', 'conus_medullaris', 'aaa', 'aortic_dissection', 'spinal_metastasis',
    'pyogenic_spondylitis', 'spinal_tb', 'fracture_dislocation', 'ectopic_pregnancy',
    'ovarian_torsion', 'testicular_torsion', 'acute_pancreatitis', 'gbs',
    'compression_fracture', 'osteoporotic_fracture', 'urolithiasis', 'pyelonephritis',
    // 追加分
    'dvt', 'epidural_abscess', 'multiple_myeloma', 'pelvic_fracture', 'renal_infarction',
    'ovarian_hemorrhage', 'herpes_zoster', 'pmr', 'femoral_head_necrosis', 'coccyx_fracture',
  ];
  for (const id of mustNotTreat) {
    const d = DISEASE_MAP[id];
    assert.ok(d, `${id} が見つかりません`);
    assert.ok(['emergency', 'refer'].includes(d.action), `${d.title}: action が「${d.action}」になっています`);
  }
});

test('レッドフラッグ6件は緊急または受診レベルで、対応するレッドフラグ定義に紐づく', () => {
  const rf = DISEASES.filter((d) => d.group === 'redflag');
  assert.equal(rf.length, 6);
  for (const d of rf) {
    assert.ok(['emergency', 'refer'].includes(d.action), `${d.title}: action が不適切`);
    assert.ok(d.flagId, `${d.title}: flagId がありません`);
  }
});
