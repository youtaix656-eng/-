import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferPatterns, scorePattern, MIN_SHARE } from '../src/lib/inference.js';
import { LOW_BACK_PATTERNS } from '../src/data/patterns.js';

const infer = (tags) => inferPatterns(tags, LOW_BACK_PATTERNS);
const topId = (tags) => {
  const r = infer(tags);
  return r.candidates.length ? r.candidates[0].pattern.id : null;
};

test('膝下への放散痛・咳で響く → 神経根症状が最上位', () => {
  assert.equal(
    topId(['neuro:radiating_below_knee', 'quality:numb', 'aggr:cough', 'region:lower_leg', 'duration:acute', 'trigger:lifting']),
    'radiculopathy',
  );
});

test('間欠跛行・前屈で楽・高齢 → 脊柱管狭窄症が最上位', () => {
  assert.equal(
    topId(['neuro:claudication', 'relief:flexion', 'aggr:extension', 'aggr:walking', 'special:elderly', 'neuro:numbness']),
    'stenosis',
  );
});

test('持ち上げで発症・急性・温めると楽 → 筋筋膜性が最上位', () => {
  assert.equal(
    topId(['trigger:lifting', 'duration:acute', 'relief:heat', 'region:lumbar_center', 'quality:dull', 'aggr:transition', 'neuro:none']),
    'myofascial',
  );
});

test('反ると悪化・前屈で楽・片側 → 椎間関節性が最上位', () => {
  assert.equal(
    topId(['aggr:extension', 'aggr:rotation', 'relief:flexion', 'region:lumbar_side', 'aggr:standing', 'duration:subacute']),
    'facet',
  );
});

test('仙腸部の限局痛・寝返りで痛む → 仙腸関節性が最上位', () => {
  assert.equal(
    topId(['region:sacroiliac', 'aggr:transition', 'region:groin', 'aggr:standing', 'quality:sharp', 'duration:subacute']),
    'sij',
  );
});

test('動作で変わらない・側腹部・発熱 → 内臓由来の疑いが最上位', () => {
  assert.equal(
    topId(['aggr:none', 'relief:none', 'region:flank', 'sys:fever', 'sys:night_pain', 'quality:throbbing']),
    'visceral_referred',
  );
});

test('妊娠関連骨盤帯痛は妊娠・産後タグが無ければ候補にならない（requireTags）', () => {
  const without = infer(['region:sacroiliac', 'aggr:transition', 'region:groin', 'aggr:walking', 'quality:dull', 'duration:chronic']);
  assert.ok(!without.candidates.some((c) => c.pattern.id === 'pgp'));
  assert.ok(!without.others.some((p) => p.id === 'pgp'));

  const withPreg = infer(['special:pregnancy', 'region:sacroiliac', 'aggr:transition', 'region:groin', 'aggr:walking', 'duration:chronic']);
  assert.equal(withPreg.candidates[0].pattern.id, 'pgp');
});

test('分離症は若年・スポーツの文脈でのみ候補になる', () => {
  const adult = infer(['aggr:extension', 'aggr:rotation', 'region:lumbar_center', 'special:elderly', 'duration:chronic', 'onset:gradual']);
  assert.ok(!adult.candidates.some((c) => c.pattern.id === 'spondylolysis'));

  const teen = infer(['special:minor', 'special:athlete', 'trigger:sports', 'aggr:extension', 'aggr:rotation', 'region:lumbar_center']);
  assert.ok(teen.candidates.some((c) => c.pattern.id === 'spondylolysis'));
});

test('％の合計は100（表示閾値で切られた分を除く）／降順に並ぶ', () => {
  const r = infer(['aggr:flexion', 'aggr:sitting', 'aggr:cough', 'duration:acute', 'trigger:lifting', 'region:lumbar_center']);
  const sum = r.candidates.reduce((a, c) => a + c.percent, 0);
  assert.ok(sum > 0 && sum <= 100);
  for (let i = 1; i < r.candidates.length; i += 1) {
    assert.ok(r.candidates[i - 1].percent >= r.candidates[i].percent);
    assert.ok(r.candidates[i].percent >= MIN_SHARE);
  }
});

test('入力が少ない時は confidence が low になり、根拠も返る', () => {
  const r = infer(['region:lumbar_center', 'quality:dull']);
  assert.equal(r.confidence, 'low');
  assert.ok(r.confidenceNote.length > 0);
});

test('タグが無ければ候補なし（根拠のない提案を作らない）', () => {
  const r = infer([]);
  assert.equal(r.candidates.length, 0);
  assert.equal(r.confidence, 'none');
});

test('scorePattern: 反証タグでスコアが下がる', () => {
  const myofascial = LOW_BACK_PATTERNS.find((p) => p.id === 'myofascial');
  const plain = scorePattern(myofascial, new Set(['trigger:lifting', 'duration:acute']));
  const withAgainst = scorePattern(myofascial, new Set(['trigger:lifting', 'duration:acute', 'neuro:radiating_below_knee']));
  assert.ok(withAgainst.score < plain.score);
  assert.equal(withAgainst.counter.length, 1);
});

test('候補には必ず「理由」が付く（説明できない提案を出さない）', () => {
  const r = infer(['neuro:radiating_below_knee', 'aggr:cough', 'region:foot', 'quality:burning', 'duration:acute', 'trigger:twisting']);
  for (const c of r.candidates) assert.ok(c.matched.length > 0, `${c.pattern.id} に根拠がありません`);
});

test('下肢への神経症状があれば、椎間板性（神経症状なし）より神経根症状を上位に出す', () => {
  const r = infer([
    'aggr:flexion', 'aggr:sitting', 'aggr:cough', 'trigger:lifting', 'onset:sudden',
    'neuro:radiating_below_knee', 'neuro:numbness', 'region:lower_leg',
  ]);
  const rank = (id) => r.candidates.findIndex((c) => c.pattern.id === id);
  assert.equal(r.candidates[0].pattern.id, 'radiculopathy');
  assert.ok(rank('discogenic') > rank('radiculopathy'));
});
