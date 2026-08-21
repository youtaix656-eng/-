import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectTags, summarize, missingFields } from '../src/lib/tags.js';
import { LOW_BACK } from '../src/data/lowBack.js';

const answers = {
  sys: ['none'],
  history: ['none'],
  special: ['none'],
  episode: 'first',
  region: ['center', 'side'],
  quality: ['dull'],
  onset: 'sudden',
  duration: 'acute',
  trigger: 'lifting',
  aggr: ['flexion', 'transition'],
  relief: ['rest', 'heat'],
  neuro: ['none'],
  work: ['heavy'],
  pain: 6,
};

test('collectTags: 選んだ選択肢のタグを重複なく集める', () => {
  const tags = collectTags(LOW_BACK, answers);
  assert.ok(tags.includes('trigger:lifting'));
  assert.ok(tags.includes('aggr:flexion'));
  assert.ok(tags.includes('onset:first_episode'));
  assert.equal(new Set(tags).size, tags.length);
});

test('collectTags: 未回答でも落ちない', () => {
  assert.deepEqual(collectTags(LOW_BACK, {}), []);
  assert.deepEqual(collectTags(LOW_BACK, { region: ['unknown-value'] }), []);
});

test('summarize: 読める形の入力サマリーを返す（ペインスケール込み）', () => {
  const rows = summarize(LOW_BACK, answers);
  const pain = rows.find((r) => r.label.includes('ペインスケール'));
  assert.equal(pain.text, '6 / 10');
  const region = rows.find((r) => r.label.includes('痛む場所'));
  assert.equal(region.text, '腰の中央、腰の片側');
});

test('missingFields: 必須の未入力を検出し、step で絞り込める', () => {
  assert.deepEqual(missingFields(LOW_BACK, answers), []);
  const partial = { ...answers };
  delete partial.pain;
  delete partial.neuro;
  const all = missingFields(LOW_BACK, partial).map((f) => f.id);
  assert.deepEqual(all.sort(), ['neuro', 'pain']);
  assert.deepEqual(missingFields(LOW_BACK, partial, 'pain').map((f) => f.id), ['pain']);
});

test('missingFields: 複数選択が空配列なら未入力扱い', () => {
  assert.ok(missingFields(LOW_BACK, { ...answers, region: [] }).some((f) => f.id === 'region'));
});

test('ペインスケール0は「未入力」ではない', () => {
  assert.ok(!missingFields(LOW_BACK, { ...answers, pain: 0 }).some((f) => f.id === 'pain'));
});
