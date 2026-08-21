import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYMPTOMS, symptomById, PLANNED_SYMPTOMS } from '../src/data/symptoms.js';
import { validateSymptom } from '../src/data/schema.js';
import { COMMON_RED_FLAGS } from '../src/data/redFlags.js';
import { triage } from '../src/lib/triage.js';
import { inferPatterns } from '../src/lib/inference.js';
import { MODALITIES } from '../src/data/licenses.js';
import { SOURCE_MAP } from '../src/data/sources.js';
import { readingInfo, OTHER_GROUP } from '../src/lib/yomi.js';

test('腰痛・肩こり頸部痛・膝痛の3症状に対応している', () => {
  assert.deepEqual(SYMPTOMS.map((s) => s.id), ['lowback', 'neck', 'knee']);
  for (const s of SYMPTOMS) {
    assert.ok(s.name && s.reading && s.icon, `${s.id}: 表示情報が足りません`);
    assert.deepEqual(validateSymptom(s), [], `${s.id} のスキーマ検証に失敗`);
  }
});

test('symptomById: 未知のIDでも落ちず、既定（腰痛）を返す', () => {
  assert.equal(symptomById('neck').id, 'neck');
  assert.equal(symptomById('unknown').id, 'lowback');
  assert.equal(symptomById(null).id, 'lowback');
});

test('どの症状も8ステップで、各ステップに設問がある', () => {
  for (const s of SYMPTOMS) {
    assert.equal(s.steps.length, 8, `${s.id}: ステップ数`);
    for (const step of s.steps) {
      assert.ok(s.fields.some((f) => f.step === step.id), `${s.id}: ${step.id} に設問がありません`);
    }
  }
});

test('どの症状にも共通の問診項目（受診・服薬・支障・イエローフラッグ）が入っている', () => {
  for (const s of SYMPTOMS) {
    const ids = s.fields.map((f) => f.id);
    for (const id of ['care', 'meds', 'impact', 'yellow']) {
      assert.ok(ids.includes(id), `${s.id}: ${id} がありません`);
    }
  }
});

test('共通のレッドフラグはすべての症状で使われる（部位が変わっても見落とさない）', () => {
  for (const s of SYMPTOMS) {
    for (const common of COMMON_RED_FLAGS) {
      assert.ok(s.redFlags.some((f) => f.id === common.id), `${s.id}: 共通レッドフラグ ${common.id} がありません`);
    }
  }
});

test('パターン・レッドフラグのIDは症状をまたいで重複しない（目次の飛び先が壊れないため）', () => {
  const ids = new Set();
  for (const s of SYMPTOMS) {
    for (const p of s.patterns) {
      assert.ok(!ids.has(p.id), `パターンID重複: ${p.id}`);
      ids.add(p.id);
    }
  }
  const flagIds = new Map();
  for (const s of SYMPTOMS) {
    for (const f of s.redFlags) {
      // 共通のレッドフラグは同じ定義が共有されているだけ（別物が同じIDを名乗っていないか確認）
      if (flagIds.has(f.id)) assert.equal(flagIds.get(f.id), f.label, `レッドフラグID重複: ${f.id}`);
      flagIds.set(f.id, f.label);
    }
  }
});

test('全パターンに読み・説明・確認所見・施術方針・ホームケア・出典がある', () => {
  for (const s of SYMPTOMS) {
    for (const p of s.patterns) {
      assert.ok(p.reading && /^[ぁ-ゖー・]+$/u.test(p.reading), `${p.id}: reading が不正`);
      assert.ok(p.description && p.description.length > 20, `${p.id}: description が不足`);
      assert.ok(p.checks?.length >= 2, `${p.id}: checks が不足`);
      assert.ok(p.approaches?.length >= 2, `${p.id}: approaches が不足`);
      assert.ok(p.homecare?.length >= 2, `${p.id}: homecare が不足`);
      assert.ok(p.sourceIds?.length >= 1, `${p.id}: 出典がありません`);
      for (const id of p.sourceIds) assert.ok(SOURCE_MAP[id], `${p.id}: 未知の出典 ${id}`);
      for (const a of p.approaches) assert.ok(MODALITIES[a.modality], `${p.id}: 未知の modality ${a.modality}`);
      assert.notEqual(readingInfo(p.tocTitle || p.name, p.reading).group, OTHER_GROUP, `${p.id}: 読みが不正`);
    }
  }
});

test('頸部：両手のしびれ・巧緻運動障害は「受診推奨」として拾う', () => {
  const neck = symptomById('neck');
  const r = triage(['neuro:both_hands', 'neuro:clumsy'], neck.redFlags);
  assert.equal(r.level, 'refer');
  assert.ok(r.flags.some((f) => f.id === 'neck_myelopathy'));
});

test('頸部：5D（複視・構音障害など）と突然の激痛は「緊急」', () => {
  const neck = symptomById('neck');
  assert.equal(triage(['sys:five_d'], neck.redFlags).level, 'stop');
  assert.equal(triage(['sys:thunderclap'], neck.redFlags).level, 'stop');
  assert.equal(triage(['sys:neck_stiffness'], neck.redFlags).level, 'stop');
});

test('膝：発熱＋関節の腫脹は「緊急」、発熱がなければ発火しない', () => {
  const knee = symptomById('knee');
  assert.equal(triage(['sys:joint_swelling', 'sys:fever'], knee.redFlags).level, 'stop');
  assert.ok(!triage(['sys:joint_swelling'], knee.redFlags).flags.some((f) => f.id === 'septic_knee'));
});

test('膝：荷重できない・ロッキングは「受診推奨」', () => {
  const knee = symptomById('knee');
  assert.equal(triage(['sys:unable_weight_bearing'], knee.redFlags).level, 'refer');
  assert.equal(triage(['sys:locking'], knee.redFlags).level, 'refer');
});

test('頸部の推定：腕への放散＋上を向くと悪化 → 頸椎症性神経根症が最上位', () => {
  const neck = symptomById('neck');
  const r = inferPatterns(
    ['neuro:radiating_arm', 'aggr:extension', 'relief:arm_abduction', 'region:upper_arm', 'quality:numb', 'duration:subacute'],
    neck.patterns,
  );
  assert.equal(r.candidates[0].pattern.id, 'neck_radiculopathy');
});

test('頸部の推定：肩上部のこり＋夕方に悪化＋デスクワーク → 肩こりが最上位', () => {
  const neck = symptomById('neck');
  const r = inferPatterns(
    ['region:shoulder_top', 'quality:stiff', 'aggr:sitting', 'aggr:evening', 'relief:heat', 'work:desk', 'neuro:none'],
    neck.patterns,
  );
  assert.equal(r.candidates[0].pattern.id, 'neck_myofascial');
});

test('膝の推定：中高年＋歩き始め＋内側 → 変形性膝関節症が最上位', () => {
  const knee = symptomById('knee');
  const r = inferPatterns(
    ['special:elderly', 'aggr:start_walking', 'region:knee_med', 'aggr:stairs_down', 'aggr:squat', 'onset:gradual'],
    knee.patterns,
  );
  assert.equal(r.candidates[0].pattern.id, 'knee_oa');
});

test('膝の推定：成長期＋脛骨粗面＋スポーツ → オスグッドが最上位', () => {
  const knee = symptomById('knee');
  const r = inferPatterns(
    ['special:growth_period', 'special:minor', 'region:tibial_tuberosity', 'trigger:sports', 'special:athlete', 'aggr:squat'],
    knee.patterns,
  );
  assert.equal(r.candidates[0].pattern.id, 'osgood');
});

test('膝の推定：オスグッド・靭帯損傷は文脈が無ければ候補にしない（requireTags）', () => {
  const knee = symptomById('knee');
  const adult = inferPatterns(
    ['special:elderly', 'region:knee_med', 'aggr:start_walking', 'onset:gradual', 'aggr:stairs_up', 'aggr:squat'],
    knee.patterns,
  );
  assert.ok(!adult.candidates.some((c) => c.pattern.id === 'osgood'));
  assert.ok(!adult.candidates.some((c) => c.pattern.id === 'knee_ligament'));
});

test('準備中の症状は対応済みの症状と重ならない', () => {
  const ready = new Set(SYMPTOMS.map((s) => s.id));
  for (const p of PLANNED_SYMPTOMS) assert.ok(!ready.has(p.id), `${p.id} は対応済みです`);
});
