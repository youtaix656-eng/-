import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YELLOW_FLAGS, yellowFlagsFor, chronicityRisk, riskSummaryText } from '../src/lib/yellowFlags.js';
import { COMMON_SAFETY_FIELDS, COMMON_LIFE_FIELDS } from '../src/data/commonFields.js';
import { isKnownTag } from '../src/data/schema.js';
import { LOW_BACK } from '../src/data/lowBack.js';
import { precautionsFor } from '../src/data/precautions.js';
import { triage } from '../src/lib/triage.js';

test('共通の問診項目のタグはすべて語彙に登録されている', () => {
  for (const f of [...COMMON_SAFETY_FIELDS, ...COMMON_LIFE_FIELDS]) {
    for (const o of f.options) {
      for (const t of o.tags) assert.ok(isKnownTag(t), `${f.id}/${o.value}: 未知のタグ ${t}`);
    }
  }
});

test('共通の問診項目が腰痛モジュールに組み込まれている', () => {
  const ids = LOW_BACK.fields.map((f) => f.id);
  for (const id of ['care', 'meds', 'impact', 'yellow']) assert.ok(ids.includes(id), `${id} がありません`);
});

test('該当なしの時はイエローフラッグを出さない', () => {
  const r = chronicityRisk(['yellow:none', 'impact:none', 'meds:none', 'duration:acute']);
  assert.equal(r.hits.length, 0);
  assert.equal(r.level, 'none');
  assert.match(riskSummaryText(r), /該当はありません/);
});

test('1件なら「低め」、2件なら「中程度」、3件以上は「高め」', () => {
  assert.equal(chronicityRisk(['yellow:fear_avoidance', 'duration:acute']).level, 'low');
  assert.equal(chronicityRisk(['yellow:fear_avoidance', 'yellow:catastrophizing', 'duration:acute']).level, 'mid');
  assert.equal(
    chronicityRisk(['yellow:fear_avoidance', 'yellow:catastrophizing', 'yellow:low_mood', 'duration:acute']).level,
    'high',
  );
});

test('経過が長い（慢性・亜急性・再発）と、少ない該当数でもリスクを上げる', () => {
  assert.equal(chronicityRisk(['yellow:fear_avoidance', 'duration:chronic']).level, 'mid');
  assert.equal(chronicityRisk(['yellow:fear_avoidance', 'yellow:low_mood', 'duration:chronic']).level, 'high');
});

test('仕事を休んでいる・眠れない・鎮痛薬が効かないも手がかりとして拾う', () => {
  assert.ok(yellowFlagsFor(['impact:off_work']).some((f) => f.id === 'rest_seeking'));
  assert.ok(yellowFlagsFor(['impact:sleep_disturbed']).some((f) => f.id === 'sleep_disturbed'));
  assert.ok(yellowFlagsFor(['meds:analgesic_ineffective']).some((f) => f.id === 'analgesic_ineffective'));
});

test('すべてのイエローフラッグに「関わり方」の助言がある（指摘だけで終わらせない）', () => {
  for (const f of YELLOW_FLAGS) {
    assert.ok(f.advice && f.advice.length > 10, `${f.title}: advice がありません`);
    assert.ok(f.detail && f.detail.length > 5, `${f.title}: detail がありません`);
  }
});

test('抗凝固薬・ステロイドの服薬は、既往歴と同じ扱いでレッドフラグ・要配慮に合流する', () => {
  const flags = triage(['meds:anticoagulant'], LOW_BACK.redFlags);
  assert.equal(flags.level, 'refer');
  assert.ok(precautionsFor(['meds:anticoagulant']).some((p) => p.id === 'anticoagulant'));
  assert.ok(precautionsFor(['meds:steroid']).some((p) => p.id === 'osteoporosis'));
});

test('鎮痛薬が効かない場合は「注意」レベルのレッドフラグが立つ', () => {
  const r = triage(['meds:analgesic_ineffective'], LOW_BACK.redFlags);
  assert.equal(r.level, 'caution');
  assert.ok(r.flags.some((f) => f.id === 'no_improvement'));
});

test('診断を受けている方には専用の配慮チェックリストが出る', () => {
  assert.ok(precautionsFor(['care:diagnosed']).some((p) => p.id === 'diagnosed'));
  assert.ok(precautionsFor(['care:post_surgery']).some((p) => p.id === 'diagnosed'));
  assert.equal(precautionsFor(['care:none']).length, 0);
});
