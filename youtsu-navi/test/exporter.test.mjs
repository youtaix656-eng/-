import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  homecareText, recordText, recordsToJson, parseRecordsJson, backupFileName,
  formatDate, formatDateTime, analyze, BACKUP_VERSION,
} from '../src/lib/exporter.js';

const record = {
  id: 'r1',
  at: Date.UTC(2026, 7, 21, 3, 5) + new Date().getTimezoneOffset() * 60000,
  clientLabel: 'A様',
  symptomId: 'lowback',
  answers: {
    sys: ['none'], history: ['none'], special: ['none'], episode: 'first',
    region: ['center'], quality: ['dull'], onset: 'sudden', duration: 'acute',
    trigger: 'lifting', aggr: ['transition'], relief: ['heat'], neuro: ['none'],
    work: ['heavy'], pain: 6,
  },
  tags: [
    'sys:none', 'history:none', 'special:none', 'onset:first_episode', 'region:lumbar_center',
    'quality:dull', 'onset:sudden', 'duration:acute', 'trigger:lifting', 'aggr:transition',
    'relief:heat', 'neuro:none', 'work:heavy_labor',
  ],
  triageLevel: 'clear',
  pain: 6,
  memo: '起立筋の緊張に対し軽擦中心。',
  followUp: '1週間後に再評価。',
};

const redFlagRecord = {
  ...record,
  id: 'r2',
  tags: ['sys:bladder_bowel', 'region:lumbar_center', 'neuro:weakness'],
  triageLevel: 'stop',
};

test('analyze: 保存したタグから判定を再現できる', () => {
  const a = analyze(record);
  assert.equal(a.triage.level, 'clear');
  assert.ok(a.inference.candidates.length > 0);
  assert.ok(a.rows.length > 0);
});

test('お客様向け：既定では推定パターン名を含めない（診断と受け取られないため）', () => {
  const text = homecareText(record);
  assert.ok(!text.includes('筋・筋膜性腰痛'), 'パターン名が含まれています');
  assert.ok(text.includes('おうちでできること'));
  assert.ok(text.includes('今回みられた特徴'));
});

test('お客様向け：オプションを立てた時だけパターン名を載せる', () => {
  const text = homecareText(record, { includePatterns: true });
  assert.ok(text.includes('筋・筋膜性腰痛'));
});

test('お客様向け：受診の目安と「診断ではない」旨を必ず含む', () => {
  const text = homecareText(record);
  assert.ok(text.includes('すぐに受診してください'));
  assert.ok(text.includes('診断ではありません'));
  assert.ok(text.includes('排尿'));
});

test('お客様向け：レッドフラグ該当時は冒頭に確認事項が入る', () => {
  const text = homecareText(redFlagRecord);
  assert.ok(text.includes('まずご確認ください'));
  assert.ok(text.indexOf('まずご確認ください') < text.indexOf('こんな時はすぐに受診'));
});

test('施術者の控え：トリアージ・候補・入力内容・メモが揃う', () => {
  const text = recordText(record, { licenseName: 'はり師・きゅう師（鍼灸師）' });
  assert.ok(text.includes('安全トリアージ'));
  assert.ok(text.includes('推定パターン'));
  assert.ok(text.includes('入力内容'));
  assert.ok(text.includes('起立筋の緊張に対し軽擦中心。'));
  assert.ok(text.includes('1週間後に再評価。'));
  assert.ok(text.includes('はり師・きゅう師（鍼灸師）'));
  assert.ok(text.includes('診断ではありません'));
});

test('施術者の控え：メモが空なら見出しごと出さない', () => {
  const text = recordText({ ...record, memo: '', followUp: '' });
  assert.ok(!text.includes('■ 施術内容・所見'));
  assert.ok(!text.includes('■ 次回へ'));
});

test('バックアップ：書き出して読み戻せる', () => {
  const json = recordsToJson([record]);
  const parsed = JSON.parse(json);
  assert.equal(parsed.app, 'youtsu-navi');
  assert.equal(parsed.kind, 'records');
  assert.equal(parsed.version, BACKUP_VERSION);
  const back = parseRecordsJson(json);
  assert.equal(back.ok, true);
  assert.equal(back.records.length, 1);
  assert.equal(back.records[0].id, 'r1');
});

test('バックアップ：壊れたファイル・別アプリのファイルは受け付けない', () => {
  assert.equal(parseRecordsJson('これはJSONではありません').ok, false);
  assert.equal(parseRecordsJson('{"app":"other","kind":"records","records":[]}').ok, false);
  assert.equal(parseRecordsJson('{"app":"youtsu-navi","kind":"settings"}').ok, false);
  assert.equal(parseRecordsJson('{"app":"youtsu-navi","kind":"records"}').ok, false);
});

test('バックアップ：形式の合わない記録は読み飛ばして知らせる', () => {
  const json = JSON.stringify({ app: 'youtsu-navi', kind: 'records', records: [record, { id: 1 }, null] });
  const r = parseRecordsJson(json);
  assert.equal(r.ok, true);
  assert.equal(r.records.length, 1);
  assert.match(r.error, /読み飛ばし/);
});

test('ファイル名に日付が入る', () => {
  assert.match(backupFileName(Date.now()), /^youtsu-navi-karte-\d{8}\.json$/);
});

test('日付の書式', () => {
  const at = new Date(2026, 7, 21, 9, 5).getTime();
  assert.equal(formatDate(at), '2026/08/21');
  assert.equal(formatDateTime(at), '2026/08/21 09:05');
});
