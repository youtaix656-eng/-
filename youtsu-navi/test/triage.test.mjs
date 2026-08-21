import { test } from 'node:test';
import assert from 'node:assert/strict';
import { triage, canTreat, matches, stackedWarning } from '../src/lib/triage.js';
import { LOW_BACK_RED_FLAGS } from '../src/data/redFlags.js';

const t = (tags) => triage(tags, LOW_BACK_RED_FLAGS);

test('馬尾症候群を疑う所見は「緊急（stop）」', () => {
  const r = t(['sys:bladder_bowel']);
  assert.equal(r.level, 'stop');
  assert.equal(canTreat(r.level), false);
  assert.ok(r.flags.some((f) => f.id === 'cauda_equina'));
});

test('会陰部のしびれ単独でも緊急として拾う', () => {
  assert.equal(t(['sys:saddle_anesthesia']).level, 'stop');
});

test('腹部の拍動性腫瘤は緊急', () => {
  assert.equal(t(['sys:abdominal_pulsatile']).level, 'stop');
});

test('がん既往・夜間痛などは「受診推奨（refer）」', () => {
  assert.equal(t(['history:cancer']).level, 'refer');
  assert.equal(t(['sys:night_pain']).level, 'refer');
  assert.equal(t(['onset:after_trauma']).level, 'refer');
});

test('年齢要因は「初発」と組み合わさった時だけ発火する（withTags）', () => {
  assert.equal(t(['special:elderly']).level, 'clear');
  assert.equal(t(['special:elderly', 'onset:first_episode']).level, 'caution');
  assert.equal(t(['special:minor', 'onset:first_episode']).level, 'caution');
});

test('レッドフラグなしは clear で、施術に進める', () => {
  const r = t(['aggr:flexion', 'duration:acute', 'region:lumbar_center']);
  assert.equal(r.level, 'clear');
  assert.equal(r.flags.length, 0);
  assert.equal(canTreat(r.level), true);
});

test('重症度の高い順に並ぶ', () => {
  const r = t(['history:cancer', 'sys:bladder_bowel', 'special:elderly', 'onset:first_episode']);
  assert.equal(r.flags[0].severity, 'emergency');
  assert.equal(r.flags[r.flags.length - 1].severity, 'caution');
});

test('複数該当の時は重なりの注意文を出す（緊急時は出さない）', () => {
  const many = t(['history:cancer', 'sys:night_pain']);
  assert.ok(stackedWarning(many).length > 0);
  assert.equal(stackedWarning(t(['sys:bladder_bowel'])), '');
});

test('matches: withTags を満たさない時は発火しない', () => {
  const flag = { id: 'x', tags: ['a:1'], withTags: ['b:2'], severity: 'caution' };
  assert.equal(matches(flag, new Set(['a:1'])), false);
  assert.equal(matches(flag, new Set(['a:1', 'b:2'])), true);
});
